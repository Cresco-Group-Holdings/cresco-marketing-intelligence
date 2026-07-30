/**
 * Capability gates — unavailable provider features remain disabled, never simulated.
 */

export type ProviderCapability = {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
};

export const LINKEDIN_ADS_CAPABILITIES: ProviderCapability[] = [
  { id: "developer_access", label: "Marketing Developer Platform access", available: true },
  { id: "oauth", label: "OAuth (r_ads, rw_ads)", available: true },
  { id: "account_access", label: "Ad account listing", available: true },
  { id: "campaign_create", label: "Campaign creation", available: true },
  { id: "sponsored_content", label: "Sponsored content", available: true },
  { id: "single_image", label: "Single-image ads", available: true },
  { id: "video_ads", label: "Video ads", available: true },
  { id: "document_ads", label: "Document ads", available: false, reason: "Requires additional creative upload API — not yet verified" },
  { id: "lead_gen_ads", label: "Lead-generation ads", available: true },
  { id: "website_visits", label: "Website visits objective", available: true },
  { id: "lead_generation", label: "Lead generation objective", available: true },
  { id: "engagement", label: "Engagement objective", available: true },
  { id: "job_targeting", label: "Job-function targeting", available: true },
  { id: "seniority_targeting", label: "Seniority targeting", available: true },
  { id: "industry_targeting", label: "Industry targeting", available: true },
  { id: "company_size", label: "Company size targeting", available: true },
  { id: "location_targeting", label: "Location targeting", available: true },
  { id: "language_targeting", label: "Language targeting", available: true },
  { id: "conversion_tracking", label: "Insight Tag conversion tracking", available: true },
  { id: "lead_forms", label: "Lead forms", available: true },
  { id: "custom_audiences", label: "Custom audiences", available: true },
  { id: "matched_audiences", label: "Matched audiences", available: false, reason: "Requires separate upload workflow — not in initial scope" },
  { id: "test_accounts", label: "Test ad accounts", available: true },
  { id: "policy_review", label: "Policy review", available: true },
];

export const TIKTOK_ADS_CAPABILITIES: ProviderCapability[] = [
  { id: "developer_access", label: "TikTok for Business developer access", available: true },
  { id: "oauth", label: "OAuth advertiser access", available: true },
  { id: "account_access", label: "Advertiser listing", available: true },
  { id: "campaign_create", label: "Campaign creation", available: true },
  { id: "traffic", label: "Traffic objective", available: true },
  { id: "video_views", label: "Video views objective", available: true },
  { id: "lead_generation", label: "Lead generation objective", available: true },
  { id: "website_conversion", label: "Website conversion objective", available: true },
  { id: "short_video", label: "Short-video ads", available: true },
  { id: "spark_ads", label: "Spark Ads", available: false, reason: "Requires creator identity authorisation — not simulated" },
  { id: "auto_placements", label: "Automatic placements", available: true },
  { id: "manual_placements", label: "Manual placements", available: true },
  { id: "broad_audience", label: "Broad audience targeting", available: true },
  { id: "interest_targeting", label: "Interest targeting", available: true },
  { id: "retargeting", label: "Retargeting audiences", available: true },
  { id: "pixel_tracking", label: "Pixel / events tracking", available: true },
  { id: "lead_forms", label: "Instant forms", available: true },
  { id: "custom_audiences", label: "Custom audiences", available: true },
  { id: "test_accounts", label: "Sandbox advertisers", available: false, reason: "Sandbox access requires separate app tier" },
  { id: "policy_review", label: "Policy review", available: true },
];

export function isCapabilityAvailable(
  capabilities: ProviderCapability[],
  capabilityId: string,
): boolean {
  const cap = capabilities.find((c) => c.id === capabilityId);
  return cap?.available ?? false;
}

export function requireCapability(
  capabilities: ProviderCapability[],
  capabilityId: string,
): void {
  const cap = capabilities.find((c) => c.id === capabilityId);
  if (!cap?.available) {
    throw new Error(
      cap?.reason ?? `Provider capability "${capabilityId}" is not available.`,
    );
  }
}

export function getDisabledCapabilities(capabilities: ProviderCapability[]): ProviderCapability[] {
  return capabilities.filter((c) => !c.available);
}
