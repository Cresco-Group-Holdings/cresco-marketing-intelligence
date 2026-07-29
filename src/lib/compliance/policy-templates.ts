import type { CompliancePolicyCategory } from "@prisma/client";

export type PolicyTemplateRule = {
  ruleKey: string;
  category: CompliancePolicyCategory;
  title: string;
  description: string;
  riskLevel: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";
  isBlocking: boolean;
  canOverride: boolean;
  matchPattern?: string;
};

export type PolicyTemplate = {
  templateKey: string;
  name: string;
  slug: string;
  category: CompliancePolicyCategory;
  description: string;
  rules: PolicyTemplateRule[];
  requiredDisclaimers: Array<{
    disclaimerText: string;
    appliesToCategories: string[];
    isBlocking: boolean;
  }>;
};

export const CRESCO_POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    templateKey: "cresco-grants-intelligence",
    name: "Cresco Grants Intelligence baseline",
    slug: "cresco-grants-intelligence",
    category: "GRANTS",
    description: "Baseline grant marketing compliance for Cresco Grants Intelligence.",
    rules: [
      {
        ruleKey: "GRANT_SUCCESS_GUARANTEE",
        category: "GRANTS",
        title: "No guarantee of grant success",
        description: "Content must not guarantee grant approval or funding outcomes.",
        riskLevel: "BLOCKING",
        isBlocking: true,
        canOverride: false,
        matchPattern: "guaranteed?\\s+(approval|funding|grant|success)",
      },
      {
        ruleKey: "GRANT_ELIGIBILITY_CONFIRMATION",
        category: "GRANTS",
        title: "Confirm eligibility independently",
        description: "Readers must be reminded to confirm eligibility independently.",
        riskLevel: "MEDIUM",
        isBlocking: false,
        canOverride: true,
      },
      {
        ruleKey: "GRANT_FUNDING_AVAILABILITY",
        category: "GRANTS",
        title: "Funding availability may change",
        description: "Do not present funding availability as permanent.",
        riskLevel: "HIGH",
        isBlocking: false,
        canOverride: true,
        matchPattern: "always available|permanent funding|unlimited grants",
      },
      {
        ruleKey: "GRANT_OUTDATED_DEADLINE",
        category: "GRANTS",
        title: "Avoid outdated deadlines",
        description: "Do not present outdated deadlines as active.",
        riskLevel: "BLOCKING",
        isBlocking: true,
        canOverride: true,
      },
    ],
    requiredDisclaimers: [
      {
        disclaimerText:
          "Grant outcomes are not guaranteed. Eligibility and funding availability may change. Confirm requirements independently.",
        appliesToCategories: ["GRANTS"],
        isBlocking: true,
      },
    ],
  },
  {
    templateKey: "capital-cresco-terminal",
    name: "Capital Cresco Terminal baseline",
    slug: "capital-cresco-terminal",
    category: "FINANCIAL",
    description: "Baseline financial marketing compliance for Capital Cresco Terminal.",
    rules: [
      {
        ruleKey: "NO_GUARANTEED_RETURNS",
        category: "FINANCIAL",
        title: "No guaranteed investment returns",
        description: "Content must not guarantee investment returns.",
        riskLevel: "BLOCKING",
        isBlocking: true,
        canOverride: false,
        matchPattern: "guaranteed?\\s+(returns?|profits?|gains?)",
      },
      {
        ruleKey: "NOT_FINANCIAL_ADVICE",
        category: "FINANCIAL",
        title: "Distinguish analysis from financial advice",
        description: "Analysis must not be presented as personalised financial advice.",
        riskLevel: "HIGH",
        isBlocking: false,
        canOverride: true,
      },
      {
        ruleKey: "NO_FABRICATED_PERFORMANCE",
        category: "FINANCIAL",
        title: "Avoid fabricated performance",
        description: "Performance claims must be supportable and not fabricated.",
        riskLevel: "BLOCKING",
        isBlocking: true,
        canOverride: false,
        matchPattern: "100% success|always profitable|never loses",
      },
    ],
    requiredDisclaimers: [
      {
        disclaimerText:
          "This is not financial advice. Past performance is not indicative of future results. Investments carry risk.",
        appliesToCategories: ["FINANCIAL"],
        isBlocking: true,
      },
    ],
  },
];
