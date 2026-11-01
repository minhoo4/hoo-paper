/** HOO WORLD contest client/server transport contract. No database writes here. */
export type ContestPhase = "scheduled" | "active" | "review" | "official" | "ended";

export interface ContestInfo {
  id: string;
  title: string;
  phase: ContestPhase;
  startsAt: string; // UTC ISO timestamp
  endsAt: string;   // UTC ISO timestamp; server is authoritative
  prizesHoo: { first: number; second: number; third: number };
}

export interface ContestOverviewPresentation {
  headline: string | null;
  body: string | null;
  posterPath: string | null;
  posterUrl?: string | null;
}

export interface ContestOverview {
  contest: ContestInfo | null;
  viewer: { joined: boolean };
  presentation?: ContestOverviewPresentation | null;
  /** Server time captured when response was generated, for clock skew adjustment. */
  serverNow: string;
}

export interface ContestRank {
  rank: number;
  nickname: string;
  roiPercent: number | null;
  realizedPnlHoo: number;
}

export interface ContestLeaderboard {
  contestId: string;
  /** max 20 entries, sorted and calculated by the trusted server */
  rows: ContestRank[];
  snapshotAt: string;
  /** hourly: shared precomputed result; personal: user-triggered on-demand read; final: closed result */
  source: "hourly" | "personal" | "final";
  /** false until verification and administrator approval */
  official: boolean;
}

export interface ContestHistoryItem {
  contestId: string;
  title: string;
  endedAt: string;
  official: boolean;
  top: ContestRank[];
}

export interface HooContestApi {
  overview(): Promise<ContestOverview>;
  leaderboard(contestId: string, mode: "cached" | "fresh"): Promise<ContestLeaderboard>;
  history(): Promise<ContestHistoryItem[]>;
  /** Only resolve {joined:true} after the server transaction has committed. */
  join(contestId: string): Promise<{ joined: true }>;
}
