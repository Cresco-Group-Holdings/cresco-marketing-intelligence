import type { GoogleAdsDraftPayload } from "./draft-mapper";

export type ValidationIssue = {
  code: string;
  severity: "ERROR" | "WARNING";
  field?: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

const MAX_HEADLINE_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 90;
const MAX_KEYWORD_LENGTH = 80;

export function validateGoogleAdsDraftLocally(draft: GoogleAdsDraftPayload): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!draft.campaign.name.trim()) {
    issues.push({ code: "MISSING_CAMPAIGN_NAME", severity: "ERROR", field: "campaign.name", message: "Campaign name is required." });
  }

  if (draft.budget.amountMicros <= 0) {
    issues.push({ code: "INVALID_BUDGET", severity: "ERROR", field: "budget.amountMicros", message: "Daily budget must be positive." });
  }

  if (draft.adGroups.length === 0) {
    issues.push({ code: "NO_AD_GROUPS", severity: "ERROR", message: "At least one ad group is required." });
  }

  for (const group of draft.adGroups) {
    if (group.keywords.length === 0) {
      issues.push({ code: "NO_KEYWORDS", severity: "ERROR", field: "adGroups.keywords", message: `Ad group "${group.name}" has no keywords.` });
    }
    for (const kw of group.keywords) {
      if (kw.text.length > MAX_KEYWORD_LENGTH) {
        issues.push({ code: "KEYWORD_TOO_LONG", severity: "ERROR", field: "keywords", message: `Keyword "${kw.text}" exceeds ${MAX_KEYWORD_LENGTH} characters.` });
      }
    }
    for (const ad of group.ads) {
      if (ad.headlines.length < 3) {
        issues.push({ code: "INSUFFICIENT_HEADLINES", severity: "ERROR", field: "ads.headlines", message: "Responsive search ads require at least 3 headlines." });
      }
      if (ad.descriptions.length < 2) {
        issues.push({ code: "INSUFFICIENT_DESCRIPTIONS", severity: "ERROR", field: "ads.descriptions", message: "Responsive search ads require at least 2 descriptions." });
      }
      for (const h of ad.headlines) {
        if (h.length > MAX_HEADLINE_LENGTH) {
          issues.push({ code: "HEADLINE_TOO_LONG", severity: "ERROR", field: "ads.headlines", message: `Headline "${h}" exceeds ${MAX_HEADLINE_LENGTH} characters.` });
        }
      }
      for (const d of ad.descriptions) {
        if (d.length > MAX_DESCRIPTION_LENGTH) {
          issues.push({ code: "DESCRIPTION_TOO_LONG", severity: "ERROR", field: "ads.descriptions", message: `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters.` });
        }
      }
      if (ad.finalUrls.length === 0 || !ad.finalUrls[0]?.startsWith("http")) {
        issues.push({ code: "INVALID_FINAL_URL", severity: "ERROR", field: "ads.finalUrls", message: "A valid final URL is required." });
      }
    }
  }

  if (draft.locations.length === 0) {
    issues.push({ code: "NO_LOCATIONS", severity: "ERROR", field: "locations", message: "At least one location target is required." });
  }

  if (draft.languages.length === 0) {
    issues.push({ code: "NO_LANGUAGES", severity: "ERROR", field: "languages", message: "At least one language target is required." });
  }

  const unverifiedConversions = draft.conversions.filter((c) => c.trackingVerified === false);
  if (unverifiedConversions.length > 0) {
    issues.push({ code: "CONVERSION_NOT_VERIFIED", severity: "WARNING", field: "conversions", message: "Some conversion goals are not verified." });
  }

  return { valid: !issues.some((i) => i.severity === "ERROR"), issues };
}

export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((r) => r.issues);
  return { valid: !issues.some((i) => i.severity === "ERROR"), issues };
}

export type ProviderValidateOnlyResponse = {
  validateOnly: true;
  partialFailure?: boolean;
  issues: ValidationIssue[];
};

export function parseValidateOnlyResponse(body: unknown): ProviderValidateOnlyResponse {
  const issues: ValidationIssue[] = [];
  const payload = body as { error?: { details?: Array<{ errors?: Array<{ message?: string; errorCode?: { policyViolationDetails?: unknown } }> }> } };
  const details = payload?.error?.details ?? [];
  for (const detail of details) {
    for (const err of detail.errors ?? []) {
      const isPolicy = Boolean(err.errorCode?.policyViolationDetails);
      issues.push({
        code: isPolicy ? "POLICY_VIOLATION" : "PROVIDER_VALIDATION_ERROR",
        severity: "ERROR",
        message: err.message ?? "Provider validation failed.",
      });
    }
  }
  return { validateOnly: true, issues };
}
