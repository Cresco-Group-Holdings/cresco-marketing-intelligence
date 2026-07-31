export const PROHIBITED_TARGETING_FIELDS = [
  "health_conditions",
  "sexual_orientation",
  "religion",
  "ethnic_affinity",
  "political_belief",
  "trade_union",
  "precise_sensitive_location",
] as const;

export type ApprovedTargetingInput = {
  countries?: string[];
  regions?: string[];
  ageMin?: number;
  ageMax?: number;
  languages?: string[];
  interests?: string[];
  broadTargeting?: boolean;
  customAudienceId?: string;
  excludedAudienceIds?: string[];
  placements?: string[];
};

export type TargetingPolicyResult = {
  allowed: boolean;
  violations: string[];
  warnings: string[];
  normalised: Record<string, unknown>;
};

const MIN_AGE = 18;
const MAX_AGE = 65;

export function validateTargetingPolicy(input: ApprovedTargetingInput): TargetingPolicyResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  if (input.ageMin !== undefined && input.ageMin < MIN_AGE) {
    violations.push(`Minimum age must be at least ${MIN_AGE}.`);
  }
  if (input.ageMax !== undefined && input.ageMax > MAX_AGE) {
    warnings.push(`Age max above ${MAX_AGE} may require additional policy review.`);
  }
  if (!input.countries?.length && !input.broadTargeting) {
    violations.push("At least one country or broad targeting flag is required.");
  }

  const raw = JSON.stringify(input).toLowerCase();
  for (const field of PROHIBITED_TARGETING_FIELDS) {
    if (raw.includes(field.replace(/_/g, "")) || raw.includes(field)) {
      violations.push(`Prohibited sensitive targeting field detected: ${field}.`);
    }
  }

  const geo: Record<string, unknown> = {};
  if (input.countries?.length) geo.countries = input.countries;
  if (input.regions?.length) geo.regions = input.regions.map((key) => ({ key }));

  const targeting: Record<string, unknown> = {
    geo_locations: Object.keys(geo).length ? geo : undefined,
    age_min: input.ageMin ?? MIN_AGE,
    age_max: input.ageMax ?? MAX_AGE,
  };
  if (input.languages?.length) targeting.locales = input.languages;
  if (input.interests?.length) targeting.flexible_spec = [{ interests: input.interests.map((name) => ({ name })) }];
  if (input.customAudienceId) targeting.custom_audiences = [{ id: input.customAudienceId }];
  if (input.excludedAudienceIds?.length) {
    targeting.excluded_custom_audiences = input.excludedAudienceIds.map((id) => ({ id }));
  }

  return {
    allowed: violations.length === 0,
    violations,
    warnings,
    normalised: targeting,
  };
}
