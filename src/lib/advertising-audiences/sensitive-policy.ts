export const PROHIBITED_SENSITIVE_ATTRIBUTES = [
  "health",
  "sexuality",
  "religion",
  "ethnicity",
  "political_belief",
  "criminal_history",
  "trade_union_membership",
  "precise_sensitive_location",
] as const;

const SENSITIVE_PATTERNS: Array<{ attribute: string; pattern: RegExp }> = [
  { attribute: "health", pattern: /\b(cancer|diabetes|mental health|pregnant|disability|medical condition)\b/i },
  { attribute: "sexuality", pattern: /\b(gay|lesbian|lgbtq|sexual orientation)\b/i },
  { attribute: "religion", pattern: /\b(christian|muslim|jewish|hindu|buddhist|religious)\b/i },
  { attribute: "ethnicity", pattern: /\b(black|white|asian|hispanic|ethnic)\b/i },
  { attribute: "political_belief", pattern: /\b(conservative|labour|democrat|republican|political party)\b/i },
  { attribute: "criminal_history", pattern: /\b(criminal record|convicted|felon)\b/i },
  { attribute: "trade_union_membership", pattern: /\b(union member|trade union)\b/i },
  { attribute: "precise_sensitive_location", pattern: /\b(abortion clinic|place of worship|addiction treatment)\b/i },
];

export type SensitiveViolation = {
  attribute: string;
  matchedText: string;
  blocking: boolean;
};

export function detectSensitiveTargeting(text: string): SensitiveViolation[] {
  const violations: SensitiveViolation[] = [];
  for (const { attribute, pattern } of SENSITIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({ attribute, matchedText: match[0], blocking: true });
    }
  }
  return violations;
}

export function hasBlockingSensitiveViolations(violations: SensitiveViolation[]): boolean {
  return violations.some((v) => v.blocking);
}

export function requiresHumanBridgeSafeguards(brandSlug?: string): boolean {
  return Boolean(brandSlug?.toLowerCase().includes("humanbridge"));
}
