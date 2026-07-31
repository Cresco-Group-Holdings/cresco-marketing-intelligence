export type RankObservationPoint = {
  observedDate: string;
  rank: number | null;
  url?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
};

export type RankHistorySummary = {
  currentPosition: number | null;
  previousPosition: number | null;
  bestPosition: number | null;
  averagePosition: number | null;
  visibilityTrend: "UP" | "DOWN" | "STABLE" | "UNKNOWN";
  rankingUrlChanges: number;
  top3Entry: boolean;
  top10Entry: boolean;
  top20Entry: boolean;
  rangeLoss: boolean;
  missingObservations: number;
};

export function summariseRankHistory(observations: RankObservationPoint[]): RankHistorySummary {
  const withRank = observations.filter((o) => o.rank != null) as Array<RankObservationPoint & { rank: number }>;
  const sorted = [...observations].sort((a, b) => a.observedDate.localeCompare(b.observedDate));

  const current = sorted.at(-1);
  const previous = sorted.length > 1 ? sorted.at(-2) : undefined;
  const currentPosition = current?.rank ?? null;
  const previousPosition = previous?.rank ?? null;

  const ranks = withRank.map((o) => o.rank);
  const bestPosition = ranks.length ? Math.min(...ranks) : null;
  const averagePosition = ranks.length
    ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10
    : null;

  let visibilityTrend: RankHistorySummary["visibilityTrend"] = "UNKNOWN";
  if (currentPosition != null && previousPosition != null) {
    if (currentPosition < previousPosition) visibilityTrend = "UP";
    else if (currentPosition > previousPosition) visibilityTrend = "DOWN";
    else visibilityTrend = "STABLE";
  }

  let rankingUrlChanges = 0;
  let prevUrl: string | null | undefined;
  for (const o of sorted) {
    if (o.url && prevUrl && o.url !== prevUrl) rankingUrlChanges++;
    if (o.url) prevUrl = o.url;
  }

  const top3Entry = currentPosition != null && currentPosition <= 3 &&
    (previousPosition == null || previousPosition > 3);
  const top10Entry = currentPosition != null && currentPosition <= 10 &&
    (previousPosition == null || previousPosition > 10);
  const top20Entry = currentPosition != null && currentPosition <= 20 &&
    (previousPosition == null || previousPosition > 20);
  const rangeLoss = previousPosition != null && previousPosition <= 20 &&
    (currentPosition == null || currentPosition > 20);

  const expectedDays = sorted.length > 1
    ? Math.ceil((new Date(sorted.at(-1)!.observedDate).getTime() - new Date(sorted[0].observedDate).getTime()) / 86400000)
    : 0;
  const missingObservations = Math.max(0, expectedDays - observations.length + 1);

  return {
    currentPosition,
    previousPosition,
    bestPosition,
    averagePosition,
    visibilityTrend,
    rankingUrlChanges,
    top3Entry,
    top10Entry,
    top20Entry,
    rangeLoss,
    missingObservations,
  };
}
