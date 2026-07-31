export type ComplianceFinding = {
  ruleId: string;
  severity: "WARNING" | "BLOCKING";
  message: string;
  matchedText?: string;
};

export type ComplianceContext = {
  brandSlug?: string;
  prohibitedClaims?: string[];
  complianceRules?: Array<{ title: string; ruleText: string; severity: string }>;
  contentType?: string;
};

const CRESCO_GRANTS_RULES = [
  {
    ruleId: "cresco-grants-no-guarantee",
    pattern: /\b(guaranteed? funding|assured grant|will (get|receive|win) (a )?grant)\b/i,
    severity: "BLOCKING" as const,
    message: "Cresco Grants: Do not guarantee funding success.",
  },
  {
    ruleId: "cresco-grants-deadline",
    pattern: /\b(deadline is (fixed|final|confirmed)|deadline will not change)\b/i,
    severity: "WARNING" as const,
    message: "Cresco Grants: Deadlines may change; advise verification.",
  },
  {
    ruleId: "cresco-grants-eligibility",
    pattern: /\b(you (are|will be) eligible|guaranteed eligible|automatically qualify)\b/i,
    severity: "BLOCKING" as const,
    message: "Cresco Grants: Eligibility must be verified; do not assert eligibility.",
  },
];

const CAPITAL_CRESCO_RULES = [
  {
    ruleId: "capital-cresco-no-returns",
    pattern: /\b(guaranteed returns?|assured profit|will (earn|make|return) \d+%)\b/i,
    severity: "BLOCKING" as const,
    message: "Capital Cresco: Do not guarantee returns or invent financial results.",
  },
  {
    ruleId: "capital-cresco-advice",
    pattern: /\b(you should (buy|sell|invest)|we recommend (buying|selling|investing))\b/i,
    severity: "BLOCKING" as const,
    message: "Capital Cresco: Distinguish analysis from financial advice.",
  },
  {
    ruleId: "capital-cresco-invented-results",
    pattern: /(returned \d+%|grew by \d+%|outperformed the market by|\d+% return)/i,
    severity: "WARNING" as const,
    message: "Capital Cresco: Verify financial results; do not invent performance data.",
  },
];

function isCrescoGrantsContext(ctx: ComplianceContext): boolean {
  const slug = ctx.brandSlug?.toLowerCase() ?? "";
  return slug.includes("grants") || slug.includes("cresco-grants");
}

function isCapitalCrescoContext(ctx: ComplianceContext): boolean {
  const slug = ctx.brandSlug?.toLowerCase() ?? "";
  return slug.includes("capital") || slug.includes("terminal");
}

export function runLongFormComplianceChecks(
  content: string,
  ctx: ComplianceContext = {},
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  for (const claim of ctx.prohibitedClaims ?? []) {
    if (claim && content.toLowerCase().includes(claim.toLowerCase())) {
      findings.push({
        ruleId: "brand-prohibited-claim",
        severity: "BLOCKING",
        message: `Prohibited claim detected: ${claim}`,
        matchedText: claim,
      });
    }
  }

  for (const rule of ctx.complianceRules ?? []) {
    if (rule.ruleText && content.toLowerCase().includes(rule.ruleText.toLowerCase().slice(0, 40))) {
      findings.push({
        ruleId: `brand-rule-${rule.title}`,
        severity: rule.severity === "BLOCKING" ? "BLOCKING" : "WARNING",
        message: rule.ruleText,
      });
    }
  }

  const productRules = [
    ...(isCrescoGrantsContext(ctx) ? CRESCO_GRANTS_RULES : []),
    ...(isCapitalCrescoContext(ctx) ? CAPITAL_CRESCO_RULES : []),
  ];

  for (const rule of productRules) {
    const match = content.match(rule.pattern);
    if (match) {
      findings.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        message: rule.message,
        matchedText: match[0],
      });
    }
  }

  return findings;
}

export function hasBlockingComplianceFindings(findings: ComplianceFinding[]): boolean {
  return findings.some((f) => f.severity === "BLOCKING");
}
