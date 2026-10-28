/**
 * HOO WORLD shop V2 — STAGING ONLY.
 * Not linked to production navigation. No client-side balance authority.
 * Requires a separately configured staging Supabase project and DB migration.
 */
import { NextResponse } from "next/server";
import { createClient as makeAdmin } from "@supabase/supabase-js";
import { createClient as makeSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ACTIONS = new Set(["purchase", "gift_purchase", "gift_inventory", "accept_gift"]);
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

function envGuard() {
  if (process.env.HOO_SHOP_V2_STAGE_ENABLED !== "true") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const expected = process.env.HOO_SHOP_V2_STAGE_PROJECT_REF;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !expected || !service || !/^[a-z0-9]{15,32}$/.test(expected)) return null;
  try {
    const parsed = new URL(url);
    // Exact project ref, not a substring test, to protect the production project.
    if (parsed.protocol !== "https:" || parsed.hostname !== `${expected}.supabase.co`) return null;
  } catch { return null; }
  return { url, service };
}
async function actorId(): Promise<string | null> {
  const session = await makeSession();
  const { data, error } = await session.auth.getUser();
  return error ? null : data.user?.id ?? null;
}
function stageDb(config: { url: string; service: string }) {
  return makeAdmin(config.url, config.service, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function stageCheck(db: ReturnType<typeof stageDb>) {
  const { data, error } = await db.from("hoo_shop_v2_environment")
    .select("environment_name").eq("id", 1).maybeSingle();
  return !error && data?.environment_name === "staging";
}

export async function GET(req: Request) {
  const config = envGuard();
  if (!config) return json({ error: "STAGING_DISABLED" }, 503);
  const uid = await actorId();
  if (!uid) return json({ error: "UNAUTHORIZED" }, 401);
  const db = stageDb(config);
  if (!(await stageCheck(db))) return json({ error: "STAGING_DB_NOT_READY" }, 503);
  // Stage-only, authenticated nickname PREFIX lookup. No emails, phone numbers or free-form DB filters.
  // Search is explicit (button-triggered) to avoid high-frequency Supabase polling.
  const params = new URL(req.url).searchParams;
  const exactRecipient = params.get("recipientId");
  if (exactRecipient !== null) {
    if (!UUID.test(exactRecipient) || exactRecipient.toLowerCase() === uid.toLowerCase() || params.has("recipientSearch"))
      return json({ error: "INVALID_RECIPIENT" }, 400);
    // Verify the immutable account ID against staging profiles before showing a name.
    // A world presence nickname is only a hint; it is NEVER the authority for transfer.
    const lookup = await db.from("profiles").select("id,nickname")
      .eq("id", exactRecipient).maybeSingle();
    if (lookup.error) {
      console.error("HOO shop V2 exact recipient lookup failed", { code: lookup.error.code });
      return json({ error: "RECIPIENT_SEARCH_UNAVAILABLE" }, 503);
    }
    if (!lookup.data || !UUID.test(String(lookup.data.id)) ||
        typeof lookup.data.nickname !== "string" || !lookup.data.nickname.trim())
      return json({ error: "RECIPIENT_NOT_FOUND" }, 404);
    return json({ recipient: { id: lookup.data.id, nickname: lookup.data.nickname } });
  }
  const search = params.get("recipientSearch");
  if (search !== null) {
    const name = search.trim();
    if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(name)) return json({ error: "INVALID_RECIPIENT_SEARCH" }, 400);
    // Escape SQL LIKE wildcard characters including the allowed underscore.
    const safePrefix = name.replace(/[\\%_]/g, "\\$&") + "%";
    const found = await db.from("profiles").select("id,nickname")
      .ilike("nickname", safePrefix).order("nickname", { ascending: true }).limit(12);
    if (found.error) {
      console.error("HOO shop V2 nickname lookup failed", { code: found.error.code });
      return json({ error: "RECIPIENT_SEARCH_UNAVAILABLE" }, 503);
    }
    const recipients = (found.data ?? []).filter((item) =>
      item.id !== uid && typeof item.nickname === "string" && UUID.test(item.id)
    ).slice(0, 10).map((item) => ({ id: item.id, nickname: item.nickname }));
    return json({ recipients });
  }
  const [products, inventory, outgoing, incoming] = await Promise.all([
    db.from("hoo_shop_v2_products").select("id,title,price_hoo,kind,asset_path")
      .eq("is_active", true).order("id").limit(100),
    db.from("hoo_shop_v2_inventory").select("product_id,quantity")
      .eq("owner_id", uid).order("product_id").limit(100),
    db.from("hoo_shop_v2_gifts").select("id,product_id,quantity,recipient_id,sender_nickname,status,message,created_at")
      .eq("sender_id", uid).order("created_at", { ascending: false }).limit(50),
    db.from("hoo_shop_v2_gifts").select("id,product_id,quantity,sender_id,sender_nickname,status,message,created_at")
      .eq("recipient_id", uid).order("created_at", { ascending: false }).limit(50),
  ]);
  if (products.error || inventory.error || outgoing.error || incoming.error) {
    console.error("HOO shop V2 read failed", {
      products: products.error?.code, inventory: inventory.error?.code,
      outgoing: outgoing.error?.code, incoming: incoming.error?.code,
    });
    return json({ error: "SHOP_READ_UNAVAILABLE" }, 503);
  }
  return json({ products: products.data, inventory: inventory.data,
    sentGifts: outgoing.data, receivedGifts: incoming.data });
}

export async function POST(req: Request) {
  const config = envGuard();
  if (!config) return json({ error: "STAGING_DISABLED" }, 503);
  const uid = await actorId();
  if (!uid) return json({ error: "UNAUTHORIZED" }, 401);
  const db = stageDb(config);
  if (!(await stageCheck(db))) return json({ error: "STAGING_DB_NOT_READY" }, 503);
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: "INVALID_BODY" }, 400);
    body = JSON.parse(raw);
  } catch { return json({ error: "INVALID_BODY" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_BODY" }, 400);
  const b = body as Record<string, unknown>;
  if (typeof b.requestId !== "string" || !UUID.test(b.requestId) ||
    typeof b.action !== "string" || !ACTIONS.has(b.action)) return json({ error: "INVALID_COMMAND" }, 400);
  const action = b.action;
  const payload: Record<string, unknown> = { action };
  if (action === "accept_gift") {
    if (typeof b.giftId !== "string" || !UUID.test(b.giftId)) return json({ error: "INVALID_GIFT" }, 400);
    payload.giftId = b.giftId;
  } else {
    if (typeof b.productId !== "string" || !PRODUCT.test(b.productId) ||
      typeof b.quantity !== "number" || !Number.isSafeInteger(b.quantity) || b.quantity < 1 || b.quantity > 20)
      return json({ error: "INVALID_PRODUCT_OR_QUANTITY" }, 400);
    payload.productId = b.productId;
    payload.quantity = b.quantity;
    if (action !== "purchase") {
      if (typeof b.recipientId !== "string" || !UUID.test(b.recipientId) || b.recipientId === uid)
        return json({ error: "INVALID_RECIPIENT" }, 400);
      if (b.message !== undefined && (typeof b.message !== "string" || b.message.length > 120))
        return json({ error: "INVALID_MESSAGE" }, 400);
      payload.recipientId = b.recipientId;
      payload.message = b.message ?? "";
    }
  }
  // Transactional authority is the DB function; clients cannot set prices or balances.
  const result = await db.rpc("hoo_shop_v2_action", {
    p_actor: uid, p_request: b.requestId, p_body: payload,
  });
  if (result.error) {
    const code = String(result.error.message || "");
    const known = ["ECONOMY_PAUSED", "SHOP_ITEM_UNAVAILABLE", "INSUFFICIENT_HOO",
      "INSUFFICIENT_ITEMS", "GIFT_DAILY_LIMIT", "GIFT_NOT_PENDING", "INVALID_GIFT_RECIPIENT",
      "DUPLICATE_REQUEST_PAYLOAD", "SHOP_STAGING_ONLY", "SHOP_BAD_INPUT"];
    const label = known.find(k => code.includes(k));
    console.error("HOO shop V2 action refused", { code: result.error.code, label: label ?? "UNCLASSIFIED" });
    return json({ error: label ?? "SHOP_ACTION_UNAVAILABLE" }, label ? 409 : 503);
  }
  return json(result.data);
}
