import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

let service: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (service) return service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("CENTRAL_BANK_SERVER_CONFIG_MISSING");
  service = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return service;
}

async function actor(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

function report(error: unknown, action: string) {
  const err = error as { message?: string; code?: string } | null;
  const msg = String(err?.message || "unknown");
  console.error(`[hoo-central-bank] ${action}`, err);
  if (msg.includes("CENTRAL_BANK_UNAUTHORIZED")) return response({ error: "관리자 권한이 없습니다." }, 403);
  if (msg.includes("CENTRAL_BANK_REQUEST_REUSED_WITH_DIFFERENT_PAYLOAD"))
    return response({ error: "이 요청번호는 다른 지급 내용에 이미 사용됐습니다." }, 409);
  if (msg.includes("CENTRAL_BANK_INVALID_INPUT"))
    return response({ error: "지급액이나 사유가 올바르지 않습니다." }, 400);
  if (msg.includes("CENTRAL_BANK_NO_REGISTERED_USERS"))
    return response({ error: "등록된 사용자가 없습니다." }, 409);
  return response({ error: "중앙은행 처리를 확인할 수 없습니다. 같은 요청번호로 재확인하세요." }, 503);
}

export async function GET(req: Request) {
  try {
    const userId = await actor(req);
    if (!userId) return response({ error: "로그인이 필요합니다." }, 401);
    const { data, error } = await db().rpc("hoo_central_bank_preview", { p_actor: userId });
    if (error) return report(error, "preview");
    return response({ ok: true, ...data });
  } catch (error) { return report(error, "preview"); }
}

export async function POST(req: Request) {
  try {
    const userId = await actor(req);
    if (!userId) return response({ error: "로그인이 필요합니다." }, 401);
    const text = await req.text();
    if (text.length > 4096) return response({ error: "요청이 너무 깁니다." }, 400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text) as Record<string, unknown>; }
    catch { return response({ error: "잘못된 요청 형식입니다." }, 400); }
    // JSON null, arrays, and scalar payloads must fail as malformed input,
    // not become an unexpected server error.
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "잘못된 요청 형식입니다." }, 400);
    }
    const amount = body.amount;
    const requestId = body.requestId;
    const note = body.note;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000 ||
        typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
        (note !== undefined && (typeof note !== "string" || note.trim().length > 120))) {
      return response({ error: "지급액(1~1,000,000 HOO), 요청번호 또는 사유가 올바르지 않습니다." }, 400);
    }
    const { data, error } = await db().rpc("hoo_central_bank_distribute", {
      p_actor: userId, p_request: requestId, p_amount: amount, p_note: typeof note === "string" ? note.trim() : "",
    });
    if (error) return report(error, "distribute");
    return response(data);
  } catch (error) { return report(error, "distribute"); }
}
