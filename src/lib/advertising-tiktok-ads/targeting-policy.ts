export type ApprovedTargetingInput = {
  countries?: string[];
  languages?: string[];
  interests?: string[];
  broad?: boolean;
  retargetingAudienceId?: string;
  exclusions?: string[];
  ageMin?: number;
  ageMax?: number;
  gender?: string;
};

const PROHIBITED_INTERESTS = ["health_conditions", "political", "religion"];

export function validateTargetingPolicy(input: ApprovedTargetingInput) {
  const violations: string[] = [];

  if (input.ageMin !== undefined && input.ageMin < 18) {
    violations.push("Minimum age must be 18 or above per TikTok policy.");
  }
  if (input.interests?.some((i) => PROHIBITED_INTERESTS.includes(i))) {
    violations.push("Prohibited sensitive interest targeting.");
  }
  if (!input.countries?.length && !input.broad) {
    violations.push("At least one country or broad targeting is required.");
  }

  const normalised: Record<string, unknown> = {
    location_ids: input.countries ?? ["US"],
    languages: input.languages ?? ["en"],
    interest_category_ids: input.interests,
    broad: input.broad ?? false,
    audience_ids: input.retargetingAudienceId ? [input.retargetingAudienceId] : undefined,
    excluded_audience_ids: input.exclusions,
    age_groups: input.ageMin && input.ageMax ? [`${input.ageMin}-${input.ageMax}`] : ["18-65"],
  };

  return { allowed: violations.length === 0, violations, normalised };
}
