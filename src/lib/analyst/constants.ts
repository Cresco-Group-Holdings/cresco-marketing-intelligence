export const ANALYST_DISCLAIMER =
  "The AI Marketing Analyst explains synchronised marketing data only. Claims are classified as measured fact, calculation, correlation, hypothesis, or recommendation. Correlation is not causation.";

export const SUGGESTED_QUESTIONS = [
  "What changed in the last 28 days?",
  "Which channels are growing?",
  "Which campaigns are underperforming?",
  "Why might traffic have declined?",
  "Which funnel step loses the most users?",
  "Which content drives conversions?",
  "Which source produces qualified leads?",
  "Where is spend inefficient?",
  "What should be investigated next?",
  "What actions should be prioritised?",
] as const;

export const BRIEF_TYPES = {
  YESTERDAY: { label: "Yesterday", days: 1 },
  LAST_7_DAYS: { label: "Last 7 days", days: 7 },
  WEEKLY: { label: "Weekly executive brief", days: 7 },
  MONTHLY: { label: "Monthly marketing brief", days: 30 },
} as const;

export type BriefType = keyof typeof BRIEF_TYPES;

export const CLAIM_TYPES = [
  "MEASURED_FACT",
  "DETERMINISTIC_CALCULATION",
  "CORRELATION",
  "HYPOTHESIS",
  "RECOMMENDATION",
  "UNAVAILABLE",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];
