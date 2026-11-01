import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Stage 2 defensive defaults. Neither flag is supplied by this package.
 * Read API can be enabled separately after reviewing its RLS behavior.
 * JOIN MUST stay off until the DB trading_contest gate and real E2E tests are approved.
 */
export const readsEnabled = () => process.env.HOO_CONTEST_READ_API_ENABLED === "true";
export const joinEnabled = () => process.env.HOO_CONTEST_JOIN_API_ENABLED === "true";

export const noStore = { "Cache-Control": "private, no-store, max-age=0" };
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: noStore });
}
export function unavailable() {
  return jsonError("대회 기능이 아직 준비 중이에요.", 503);
}

export async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, response: jsonError("로그인이 필요합니다.", 401) };
  }
  return { ok: true as const, supabase, user };
}

export const isUuid = (x: unknown): x is string =>
  typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

export function safeNumber(value: unknown): number {
  const x = Number(value);
  return Number.isSafeInteger(x) ? x : 0;
}
export function safeDecimal(value: unknown): number {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}
