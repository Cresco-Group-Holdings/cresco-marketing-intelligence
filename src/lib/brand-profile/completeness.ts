import type { BrandProfile } from "@prisma/client";

const PROFILE_FIELDS: Array<keyof BrandProfile> = [
  "shortDescription",
  "longDescription",
  "mission",
  "valueProposition",
  "targetAudience",
  "customerProblems",
  "keyBenefits",
  "productsAndServices",
  "preferredTone",
  "prohibitedTone",
  "preferredLanguage",
];

export function calculateBrandProfileCompleteness(profile: Partial<BrandProfile>): number {
  let filled = 0;
  const total = PROFILE_FIELDS.length + 3;

  for (const field of PROFILE_FIELDS) {
    const value = profile[field];
    if (typeof value === "string" && value.trim().length > 0) {
      filled += 1;
    }
  }

  if (profile.targetCountries && profile.targetCountries.length > 0) filled += 1;
  if (profile.targetIndustries && profile.targetIndustries.length > 0) filled += 1;
  if (profile.competitors && profile.competitors.length > 0) filled += 1;

  return Math.round((filled / total) * 100);
}

export const ESSENTIAL_BRAND_PROFILE_FIELDS: Array<keyof BrandProfile> = [
  "shortDescription",
  "targetAudience",
  "valueProposition",
];

export function hasEssentialBrandProfileFields(profile: Partial<BrandProfile>): boolean {
  return ESSENTIAL_BRAND_PROFILE_FIELDS.every((field) => {
    const value = profile[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}
