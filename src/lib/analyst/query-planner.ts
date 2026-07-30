export type ApprovedMetric =
  | "visitors"
  | "leads"
  | "qualifiedLeads"
  | "signups"
  | "trials"
  | "customers"
  | "conversionRate"
  | "marketingSpend"
  | "revenue"
  | "mrr"
  | "cac"
  | "attributedRevenue"
  | "organicTraffic"
  | "paidTraffic"
  | "socialEngagement";

export type ApprovedDimension =
  | "channel"
  | "campaign"
  | "country"
  | "source"
  | "content"
  | "funnel_step"
  | "plan";

export type QueryOperation =
  | "SUM"
  | "COUNT"
  | "AVG"
  | "COMPARE_PERIOD"
  | "TOP_N"
  | "TREND";

export type PlannedQuery = {
  operation: QueryOperation;
  metric: ApprovedMetric;
  dimension?: ApprovedDimension;
  dateRangeDays: number;
  limit?: number;
};

const APPROVED_METRICS = new Set<ApprovedMetric>([
  "visitors",
  "leads",
  "qualifiedLeads",
  "signups",
  "trials",
  "customers",
  "conversionRate",
  "marketingSpend",
  "revenue",
  "mrr",
  "cac",
  "attributedRevenue",
  "organicTraffic",
  "paidTraffic",
  "socialEngagement",
]);

const MAX_DATE_RANGE_DAYS = 365;
const MAX_QUERIES_PER_REQUEST = 12;
const MAX_TOP_N = 25;

const QUESTION_PATTERNS: Array<{ pattern: RegExp; queries: PlannedQuery[] }> = [
  {
    pattern: /what changed|overview|summary/i,
    queries: [
      { operation: "COMPARE_PERIOD", metric: "visitors", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "revenue", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "leads", dateRangeDays: 28 },
    ],
  },
  {
    pattern: /channel|growing/i,
    queries: [
      { operation: "COMPARE_PERIOD", metric: "organicTraffic", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "paidTraffic", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "socialEngagement", dateRangeDays: 28 },
    ],
  },
  {
    pattern: /campaign|underperform/i,
    queries: [{ operation: "TOP_N", metric: "marketingSpend", dimension: "campaign", dateRangeDays: 28, limit: 10 }],
  },
  {
    pattern: /traffic|declin/i,
    queries: [
      { operation: "COMPARE_PERIOD", metric: "visitors", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "organicTraffic", dateRangeDays: 28 },
    ],
  },
  {
    pattern: /funnel|drop.?off|lose/i,
    queries: [{ operation: "TOP_N", metric: "conversionRate", dimension: "funnel_step", dateRangeDays: 28, limit: 5 }],
  },
  {
    pattern: /content|conversion/i,
    queries: [{ operation: "TOP_N", metric: "attributedRevenue", dimension: "content", dateRangeDays: 28, limit: 10 }],
  },
  {
    pattern: /lead|qualified/i,
    queries: [
      { operation: "COMPARE_PERIOD", metric: "leads", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "qualifiedLeads", dateRangeDays: 28 },
    ],
  },
  {
    pattern: /spend|inefficient|cac/i,
    queries: [
      { operation: "COMPARE_PERIOD", metric: "marketingSpend", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "cac", dateRangeDays: 28 },
    ],
  },
  {
    pattern: /investigat|prioriti|action|next/i,
    queries: [
      { operation: "COMPARE_PERIOD", metric: "revenue", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "mrr", dateRangeDays: 28 },
      { operation: "COMPARE_PERIOD", metric: "attributedRevenue", dateRangeDays: 28 },
    ],
  },
];

const DEFAULT_QUERIES: PlannedQuery[] = [
  { operation: "COMPARE_PERIOD", metric: "visitors", dateRangeDays: 28 },
  { operation: "COMPARE_PERIOD", metric: "revenue", dateRangeDays: 28 },
  { operation: "COMPARE_PERIOD", metric: "leads", dateRangeDays: 28 },
];

export function planQueries(question: string, dateRangeDays = 28): PlannedQuery[] {
  const boundedDays = Math.min(Math.max(1, dateRangeDays), MAX_DATE_RANGE_DAYS);
  const matched: PlannedQuery[] = [];

  for (const entry of QUESTION_PATTERNS) {
    if (entry.pattern.test(question)) {
      matched.push(...entry.queries.map((q) => ({ ...q, dateRangeDays: boundedDays })));
    }
  }

  const queries = (matched.length > 0 ? matched : DEFAULT_QUERIES).slice(0, MAX_QUERIES_PER_REQUEST);
  return queries.filter(validateQuery);
}

export function validateQuery(query: PlannedQuery): boolean {
  if (!APPROVED_METRICS.has(query.metric)) return false;
  if (query.dateRangeDays < 1 || query.dateRangeDays > MAX_DATE_RANGE_DAYS) return false;
  if (query.limit != null && (query.limit < 1 || query.limit > MAX_TOP_N)) return false;
  return true;
}

export const QUERY_PLANNER_LIMITS = {
  maxDateRangeDays: MAX_DATE_RANGE_DAYS,
  maxQueriesPerRequest: MAX_QUERIES_PER_REQUEST,
  maxTopN: MAX_TOP_N,
};
