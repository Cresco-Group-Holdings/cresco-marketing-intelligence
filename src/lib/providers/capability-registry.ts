/** Canonical provider capability keys — central registry for the provider gateway. */
export const CANONICAL_PROVIDER_CAPABILITIES = [
  "AD_ACCOUNTS_READ",
  "AD_CAMPAIGNS_READ",
  "AD_CAMPAIGNS_WRITE",
  "AD_CREATIVES_READ",
  "AD_CREATIVES_WRITE",
  "AD_INSIGHTS_READ",
  "ANALYTICS_PROPERTIES_READ",
  "ANALYTICS_REPORTS_READ",
  "SOCIAL_ACCOUNTS_READ",
  "SOCIAL_CONTENT_READ",
  "SOCIAL_CONTENT_PUBLISH",
  "SOCIAL_INSIGHTS_READ",
  "CRM_CONTACTS_READ",
  "CRM_CONTACTS_WRITE",
  "CRM_COMPANIES_READ",
  "CRM_COMPANIES_WRITE",
  "CRM_LEADS_READ",
  "CRM_LEADS_WRITE",
  "EMAIL_CAMPAIGNS_READ",
  "EMAIL_CAMPAIGNS_WRITE",
  "EMAIL_PERFORMANCE_READ",
  "CALENDAR_EVENTS_READ",
  "CALENDAR_EVENTS_WRITE",
  "FILES_READ",
  "FILES_WRITE",
  "WEBHOOKS_RECEIVE",
] as const;

export type CanonicalProviderCapability = (typeof CANONICAL_PROVIDER_CAPABILITIES)[number];

export function isCanonicalCapability(value: string): value is CanonicalProviderCapability {
  return (CANONICAL_PROVIDER_CAPABILITIES as readonly string[]).includes(value);
}

export const MOCK_ADVERTISING_CAPABILITIES: CanonicalProviderCapability[] = [
  "AD_ACCOUNTS_READ",
  "AD_CAMPAIGNS_READ",
  "AD_CAMPAIGNS_WRITE",
  "AD_CREATIVES_WRITE",
  "AD_INSIGHTS_READ",
];

export const MOCK_CRM_CAPABILITIES: CanonicalProviderCapability[] = [
  "CRM_CONTACTS_READ",
  "CRM_COMPANIES_READ",
  "WEBHOOKS_RECEIVE",
];

export const MOCK_SOCIAL_CAPABILITIES: CanonicalProviderCapability[] = [
  "SOCIAL_CONTENT_PUBLISH",
  "SOCIAL_ACCOUNTS_READ",
];

export const META_SOCIAL_CAPABILITIES: CanonicalProviderCapability[] = [
  "SOCIAL_CONTENT_PUBLISH",
  "SOCIAL_ACCOUNTS_READ",
  "SOCIAL_CONTENT_READ",
];

export function providerSupportsCapability(
  providerKey: string,
  capability: CanonicalProviderCapability,
): boolean {
  if (providerKey === "meta" || providerKey === "meta-ads") {
    return META_SOCIAL_CAPABILITIES.includes(capability);
  }
  if (providerKey === "mock-advertising") {
    return MOCK_ADVERTISING_CAPABILITIES.includes(capability);
  }
  if (providerKey === "mock-crm") {
    return MOCK_CRM_CAPABILITIES.includes(capability);
  }
  if (providerKey === "mock-social") {
    return MOCK_SOCIAL_CAPABILITIES.includes(capability);
  }
  return false;
}

export function listProviderCapabilities(providerKey: string): CanonicalProviderCapability[] {
  if (providerKey === "meta" || providerKey === "meta-ads") return META_SOCIAL_CAPABILITIES;
  if (providerKey === "mock-advertising") return MOCK_ADVERTISING_CAPABILITIES;
  if (providerKey === "mock-crm") return MOCK_CRM_CAPABILITIES;
  if (providerKey === "mock-social") return MOCK_SOCIAL_CAPABILITIES;
  return [];
}
