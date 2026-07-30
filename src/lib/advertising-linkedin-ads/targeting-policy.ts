export type ApprovedTargetingInput = {
  countries?: string[];
  regions?: string[];
  languages?: string[];
  industries?: string[];
  jobFunctions?: string[];
  seniorities?: string[];
  companySizes?: string[];
  interests?: string[];
  broad?: boolean;
  retargetingAudienceId?: string;
  exclusions?: string[];
  /** Prohibited — employment discrimination fields */
  age?: number;
  gender?: string;
  race?: string;
  religion?: string;
};

const PROHIBITED_FIELDS = ["age", "gender", "race", "religion"] as const;

const PROHIBITED_INTERESTS = [
  "health_conditions",
  "sexual_orientation",
  "political_affiliation",
  "religion",
  "race_ethnicity",
];

export function validateTargetingPolicy(input: ApprovedTargetingInput) {
  const violations: string[] = [];

  for (const field of PROHIBITED_FIELDS) {
    if (input[field] !== undefined) {
      violations.push(`Prohibited sensitive targeting field: ${field}`);
    }
  }

  if (input.interests?.some((i) => PROHIBITED_INTERESTS.includes(i))) {
    violations.push("Prohibited sensitive interest targeting.");
  }

  if (!input.countries?.length && !input.broad) {
    violations.push("At least one country or broad targeting is required.");
  }

  const normalised: Record<string, unknown> = {
    geoLocations: { countries: input.countries ?? ["US"] },
    locales: input.languages ?? ["en"],
    industries: input.industries,
    jobFunctions: input.jobFunctions,
    seniorities: input.seniorities,
    companySizes: input.companySizes,
    interests: input.interests,
    broad: input.broad ?? false,
    retargetingAudienceId: input.retargetingAudienceId,
    exclusions: input.exclusions,
  };

  return { allowed: violations.length === 0, violations, normalised };
}
