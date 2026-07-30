import type { MetaAdsDraftPayload } from "./draft-mapper";
import { validateMetaCreative } from "./creative-validation";

export type ValidationIssue = {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
};

export function validateMetaAdsDraftLocally(
  draft: MetaAdsDraftPayload,
  options?: { localComplianceFindings?: string[] },
): { valid: boolean; issues: ValidationIssue[]; localOnly: boolean } {
  const issues: ValidationIssue[] = [];

  if (!draft.campaign.name.trim()) {
    issues.push({ code: "MISSING_CAMPAIGN_NAME", severity: "ERROR", message: "Campaign name is required." });
  }
  if (!draft.adSet.daily_budget && !draft.adSet.lifetime_budget) {
    issues.push({ code: "MISSING_BUDGET", severity: "ERROR", message: "Daily or lifetime budget required." });
  }
  if (!draft.assets.facebook_page_id) {
    issues.push({ code: "MISSING_PAGE", severity: "ERROR", message: "Facebook Page must be selected." });
  }

  const creativeResult = validateMetaCreative({
    format: draft.creative.format,
    primaryText: draft.creative.primaryText,
    headline: draft.creative.headline,
    description: draft.creative.description,
    destinationUrl: draft.creative.link,
    facebookPageId: draft.assets.facebook_page_id,
    instagramAccountId: draft.assets.instagram_actor_id,
    placement: draft.adSet.publisher_platforms.join(","),
  });
  issues.push(...creativeResult.issues);

  for (const finding of options?.localComplianceFindings ?? []) {
    issues.push({ code: "LOCAL_COMPLIANCE", severity: "WARNING", message: finding });
  }

  issues.push({
    code: "LOCAL_VALIDATION_ONLY",
    severity: "WARNING",
    message: "Local validation does not guarantee Meta policy approval.",
  });

  return {
    valid: !issues.some((i) => i.severity === "ERROR"),
    issues,
    localOnly: true,
  };
}

export function parseMetaApiError(body: unknown): ValidationIssue[] {
  const payload = body as { error?: { message?: string; code?: number; error_subcode?: number } };
  if (!payload?.error) return [];
  return [{
    code: `META_${payload.error.code ?? "ERROR"}`,
    severity: "ERROR",
    message: payload.error.message ?? "Meta API validation failed.",
  }];
}
