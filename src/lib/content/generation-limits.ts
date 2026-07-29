export const CONTENT_GENERATION_LIMITS = {
  maxPlatforms: 6,
  maxVariantsPerRequest: 3,
  maxBriefLength: 2_000,
  maxSourceTextLength: 8_000,
  maxTitleLength: 300,
  maxHashtags: 30,
  maxRegenerationsPerHour: 30,
} as const;

export function assertGenerationVariantCount(count: number): void {
  if (count < 1 || count > CONTENT_GENERATION_LIMITS.maxVariantsPerRequest) {
    throw new Error(
      `Variant count must be between 1 and ${CONTENT_GENERATION_LIMITS.maxVariantsPerRequest}.`,
    );
  }
}

export function assertPlatformCount(count: number): void {
  if (count < 1 || count > CONTENT_GENERATION_LIMITS.maxPlatforms) {
    throw new Error(
      `Platform count must be between 1 and ${CONTENT_GENERATION_LIMITS.maxPlatforms}.`,
    );
  }
}
