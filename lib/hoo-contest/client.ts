import type { HooContestApi, ContestLeaderboard, ContestHistoryItem, ContestOverview } from "./contracts";

/**
 * API adapter for approved server routes. These routes do NOT ship with stage 1:
 * the real schema, authenticated participant RPC, ranking SQL and release gates
 * must first be reconciled against the live repository and database.
 * Never enable the widget against production until that work is complete.
 */
const root = "/api/hoo-contest";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${root}${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  if (!response.ok) {
    // Do not leak raw DB errors, security secrets or service-role details to UI.
    if (response.status === 401) throw new Error("로그인 후 이용할 수 있어요.");
    if (response.status === 403 || response.status === 423 || response.status === 503)
      throw new Error("대회 기능이 아직 열리지 않았거나 점검 중이에요.");
    if (response.status === 429) throw new Error("요청이 많아요. 잠시 뒤 다시 시도해 주세요.");
    throw new Error("대회 정보를 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }
  return (await response.json()) as T;
}

export function createHooContestApi(): HooContestApi {
  return {
    overview: () => request<ContestOverview>("/overview"),
    leaderboard: (id, mode) => request<ContestLeaderboard>(
      `/leaderboard?contestId=${encodeURIComponent(id)}&mode=${mode}`,
    ),
    history: () => request<ContestHistoryItem[]>("/history"),
    join: (id) => request<{ joined: true }>("/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contestId: id }),
    }),
  };
}
