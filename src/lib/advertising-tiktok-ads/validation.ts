import type { TikTokAdsDraftPayload } from "./draft-mapper";
import { validateTikTokCreative } from "./creative-validation";

const VALIDATION_DISCLAIMER =
  "Local validation does not guarantee TikTok policy approval or ad delivery.";

export function validateTikTokAdsDraftLocally(draft: Record<string, unknown>) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const campaign = draft.campaign as Record<string, unknown> | undefined;
  const adGroup = draft.adGroup as Record<string, unknown> | undefined;
  const ad = draft.ad as Record<string, unknown> | undefined;

  if (!campaign?.objective) errors.push("Campaign objective is required.");
  if (!adGroup?.budget) errors.push("Ad group budget is required.");
  if (!ad?.adText) errors.push("Ad text is required.");

  return { valid: errors.length === 0, errors, warnings, disclaimer: VALIDATION_DISCLAIMER };
}

export function validateTikTokAdsDraft(draft: TikTokAdsDraftPayload) {
  const local = validateTikTokAdsDraftLocally(draft as unknown as Record<string, unknown>);
  const creative = validateTikTokCreative({
    format: draft.creative.format,
    adText: draft.ad.adText,
    destinationUrl: draft.ad.landingPageUrl,
    videoUrl: draft.creative.videoUrl,
  });

  return {
    valid: local.valid && creative.valid,
    errors: [...local.errors, ...creative.errors],
    warnings: [...local.warnings, ...creative.warnings],
    disclaimer: local.disclaimer,
  };
}
