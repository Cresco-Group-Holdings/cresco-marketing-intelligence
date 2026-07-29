import type { LeadQualificationProfile } from "@prisma/client";

export type QualificationField = {
  key: string;
  label: string;
  required?: boolean;
};

export const QUALIFICATION_FIELDS: Record<LeadQualificationProfile, QualificationField[]> = {
  CRESCO_GRANTS_INTELLIGENCE: [
    { key: "organisationType", label: "Organisation type", required: true },
    { key: "fundingNeed", label: "Funding need", required: true },
    { key: "location", label: "Location", required: true },
    { key: "grantInterest", label: "Grant interest", required: true },
    { key: "applicationTimeframe", label: "Application timeframe" },
  ],
  CAPITAL_CRESCO_TERMINAL: [
    { key: "investorOrAnalystType", label: "Investor or analyst type", required: true },
    { key: "researchNeed", label: "Research need", required: true },
    { key: "intendedUse", label: "Intended use", required: true },
    { key: "organisation", label: "Organisation", required: true },
    { key: "demoInterest", label: "Demo interest" },
  ],
};

export type QualificationAnswers = Record<string, string | boolean | null | undefined>;

export function evaluateQualificationRules(
  profile: LeadQualificationProfile,
  answers: QualificationAnswers,
): { qualified: boolean; missingFields: string[] } {
  const fields = QUALIFICATION_FIELDS[profile];
  const missingFields = fields
    .filter((field) => field.required)
    .filter((field) => {
      const value = answers[field.key];
      return value === undefined || value === null || String(value).trim() === "";
    })
    .map((field) => field.key);

  return {
    qualified: missingFields.length === 0,
    missingFields,
  };
}
