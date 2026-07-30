import { SUPPORTED_CREATIVE_FORMATS } from "./constants";

export type LinkedInCreativeInput = {
  format: string;
  headline: string;
  description?: string;
  destinationUrl: string;
  imageUrl?: string;
  videoUrl?: string;
  leadFormId?: string;
};

export function validateLinkedInCreative(input: LinkedInCreativeInput) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(SUPPORTED_CREATIVE_FORMATS as readonly string[]).includes(input.format)) {
    errors.push(`Unsupported creative format: ${input.format}`);
  }
  if (input.format === "DOCUMENT") {
    errors.push("Document ads are not yet verified — capability gate disabled.");
  }
  if (!input.headline || input.headline.length > 200) {
    errors.push("Headline required and must be ≤ 200 characters.");
  }
  if (input.description && input.description.length > 600) {
    errors.push("Description must be ≤ 600 characters.");
  }
  if (!input.destinationUrl && input.format !== "LEAD_FORM") {
    errors.push("Destination URL is required.");
  }
  if (input.format === "SINGLE_IMAGE" && !input.imageUrl) {
    warnings.push("Image URL not provided — upload required before launch.");
  }
  if (input.format === "VIDEO" && !input.videoUrl) {
    warnings.push("Video URL not provided — upload required before launch.");
  }
  if (input.format === "LEAD_FORM" && !input.leadFormId) {
    warnings.push("Lead form ID not provided — configure before launch.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
