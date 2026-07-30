import { SUPPORTED_CREATIVE_FORMATS } from "./constants";
import { isCapabilityAvailable, TIKTOK_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";

export type TikTokCreativeInput = {
  format: string;
  videoUrl?: string;
  adText: string;
  destinationUrl: string;
  sparkAdAuthorized?: boolean;
};

export function validateTikTokCreative(input: TikTokCreativeInput) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(SUPPORTED_CREATIVE_FORMATS as readonly string[]).includes(input.format)) {
    errors.push(`Unsupported creative format: ${input.format}`);
  }
  if (input.format === "SPARK_AD" || input.sparkAdAuthorized) {
    if (!isCapabilityAvailable(TIKTOK_ADS_CAPABILITIES, "spark_ads")) {
      errors.push("Spark Ads require creator identity authorisation — not simulated.");
    }
  }
  if (!input.adText || input.adText.length > 100) {
    errors.push("Ad text required and must be ≤ 100 characters.");
  }
  if (!input.destinationUrl) {
    errors.push("Destination URL is required.");
  }
  if (!input.videoUrl) {
    warnings.push("Video URL not provided — upload required before launch.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
