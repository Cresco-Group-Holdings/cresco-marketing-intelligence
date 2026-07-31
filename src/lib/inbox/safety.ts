import type { SocialSafetyFlag } from "@prisma/client";

const SAFETY_RULES: Array<{ flag: SocialSafetyFlag; pattern: RegExp }> = [
  { flag: "SPAM", pattern: /\b(buy followers|click here now|free money|act now)\b/i },
  { flag: "ABUSIVE_LANGUAGE", pattern: /\b(idiot|stupid|hate you|kill yourself)\b/i },
  {
    flag: "PERSONAL_DATA",
    pattern: /\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  },
  { flag: "THREAT", pattern: /\b(i will (hurt|sue|report)|legal action against you)\b/i },
  {
    flag: "FINANCIAL_ADVICE",
    pattern: /\b(guaranteed returns?|invest now|financial advice|risk-free)\b/i,
  },
  {
    flag: "GRANT_ELIGIBILITY",
    pattern: /\b(guaranteed grant|everyone qualifies|free government money)\b/i,
  },
  { flag: "COMPLAINT_REVIEW", pattern: /\b(refund|complaint|unsatisfied|report you|lawyer)\b/i },
];

/** Detects inbox safety flags from inbound message or comment text. */
export function detectSafetyFlags(text: string): SocialSafetyFlag[] {
  const flags = new Set<SocialSafetyFlag>();
  for (const rule of SAFETY_RULES) {
    if (rule.pattern.test(text)) {
      flags.add(rule.flag);
    }
  }
  return [...flags];
}

export function requiresHumanReview(flags: SocialSafetyFlag[]): boolean {
  return flags.some((flag) =>
    ["THREAT", "PERSONAL_DATA", "FINANCIAL_ADVICE", "GRANT_ELIGIBILITY", "COMPLAINT_REVIEW"].includes(
      flag,
    ),
  );
}
