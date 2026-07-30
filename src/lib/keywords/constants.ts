/** Keyword intelligence operational constants. */
export const KEYWORD_NORMALISATION_VERSION = 1;

export const KEYWORD_MIN_IMPRESSIONS_FOR_OPPORTUNITY = 50;
export const KEYWORD_MIN_CTR_THRESHOLD = 0.02;
export const KEYWORD_POSITION_OPPORTUNITY_MIN = 4;
export const KEYWORD_POSITION_OPPORTUNITY_MAX = 20;
export const KEYWORD_CANNIBALISATION_MIN_PAGES = 2;

export const KEYWORD_METRIC_DEFINITIONS = [
  { type: "IMPRESSIONS", unit: "count", nullable: true },
  { type: "CLICKS", unit: "count", nullable: true },
  { type: "CTR", unit: "ratio", nullable: true },
  { type: "AVERAGE_POSITION", unit: "position", nullable: true },
  { type: "SEARCH_VOLUME", unit: "count", nullable: true },
  { type: "CPC", unit: "currency", nullable: true },
  { type: "COMPETITION", unit: "ratio", nullable: true },
  { type: "DIFFICULTY", unit: "score", nullable: true },
  { type: "TREND", unit: "delta", nullable: true },
  { type: "RESULT_COUNT", unit: "count", nullable: true },
  { type: "RANKING_URL", unit: "url", nullable: true },
  { type: "RANK_POSITION", unit: "position", nullable: true },
] as const;

export const KEYWORD_CSV_FIELDS = [
  "keyword",
  "language",
  "country",
  "volume",
  "cpc",
  "difficulty",
  "position",
  "url",
  "tags",
] as const;
