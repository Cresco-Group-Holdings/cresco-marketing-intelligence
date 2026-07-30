import type { LinkedInAdsDraftPayload } from "./draft-mapper";
import { validateLinkedInCreative } from "./creative-validation";

const VALIDATION_DISCLAIMER =
  "Local validation does not guarantee LinkedIn policy approval or ad delivery.";

export function validateLinkedInAdsDraftLocally(draft: Record<string, unknown>) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const campaign = draft.campaign as Record<string, unknown> | undefined;
  const creative = draft.creative as Record<string, unknown> | undefined;
  const budget = draft.budget as Record<string, unknown> | undefined;

  if (!campaign?.objective) errors.push("Campaign objective is required.");
  if (!creative?.headline) errors.push("Creative headline is required.");
  if (!budget?.dailyBudgetCents) errors.push("Daily budget is required.");

  return { valid: errors.length === 0, errors, warnings, disclaimer: VALIDATION_DISCLAIMER };
}

export function validateLinkedInAdsDraft(draft: LinkedInAdsDraftPayload) {
  const local = validateLinkedInAdsDraftLocally(draft as unknown as Record<string, unknown>);
  const creative = validateLinkedInCreative({
    format: draft.creative.format,
    headline: draft.creative.headline,
    description: draft.creative.description,
    destinationUrl: draft.creative.destinationUrl,
  });

  return {
    valid: local.valid && creative.valid,
    errors: [...local.errors, ...creative.errors],
    warnings: [...local.warnings, ...creative.warnings],
    disclaimer: local.disclaimer,
  };
}
