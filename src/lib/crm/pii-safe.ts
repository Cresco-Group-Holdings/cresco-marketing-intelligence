const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/;
const PII_METADATA_KEYS = new Set([
  "email",
  "phone",
  "mobile",
  "displayName",
  "firstName",
  "lastName",
  "name",
  "address",
  "postalCode",
  "ipAddress",
  "contactValue",
  "normalisedValue",
]);

export function containsPiiInUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://placeholder.local");
    const haystack = `${parsed.pathname}${parsed.search}`;
    return EMAIL_PATTERN.test(haystack) || PHONE_PATTERN.test(haystack);
  } catch {
    return EMAIL_PATTERN.test(url) || PHONE_PATTERN.test(url);
  }
}

export function assertNoPiiInUrl(url: string): void {
  if (containsPiiInUrl(url)) {
    throw new Error("URLs must not contain personal identifiers.");
  }
}

export function sanitiseActivityMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (PII_METADATA_KEYS.has(key)) continue;
    if (typeof value === "string" && (EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value))) {
      continue;
    }
    safe[key] = value;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export function redactForRestrictedLog(value: string): string {
  if (EMAIL_PATTERN.test(value)) return "[redacted-email]";
  if (PHONE_PATTERN.test(value)) return "[redacted-phone]";
  return value;
}

export type CrmLeadExportRecord = {
  id: string;
  status: string;
  lifecycleStage: string;
  qualificationState: string;
  retentionStatus: string;
  lawfulBasis?: string | null;
  primaryProductInterest?: string | null;
  country?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  sourceType?: string | null;
  utmCampaign?: string | null;
  firstTouchCampaign?: string | null;
  lastTouchCampaign?: string | null;
};

export function minimiseCrmLeadExport(
  record: CrmLeadExportRecord,
  scope: "FULL" | "SUMMARY",
): Record<string, unknown> {
  const base = {
    id: record.id,
    status: record.status,
    lifecycleStage: record.lifecycleStage,
    qualificationState: record.qualificationState,
    retentionStatus: record.retentionStatus,
    primaryProductInterest: record.primaryProductInterest ?? undefined,
    country: record.country ?? undefined,
    sourceType: record.sourceType ?? undefined,
    utmCampaign: record.utmCampaign ?? undefined,
    firstTouchCampaign: record.firstTouchCampaign ?? undefined,
    lastTouchCampaign: record.lastTouchCampaign ?? undefined,
  };

  if (scope === "SUMMARY") {
    return base;
  }

  return {
    ...base,
    lawfulBasis: record.lawfulBasis ?? undefined,
    displayName: record.displayName ?? undefined,
    email: record.email ?? undefined,
    phone: record.phone ?? undefined,
    companyName: record.companyName ?? undefined,
  };
}

export function buildAnonymisationPreview(leadId: string) {
  return {
    leadId,
    fieldsToClear: ["displayName", "email", "phone", "contactMethods", "addresses"],
    retentionStatus: "ANONYMISED",
    requiresAudit: true,
    reversible: false,
  };
}
