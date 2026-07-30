import { MIN_AUDIENCE_SIZE_DEFAULT } from "@/lib/advertising-audiences/constants";

export type ProviderAudienceMapping = {
  provider: string;
  providerAudienceType: string;
  minimumSizeRule: number;
  requiredIdentifierType: string;
  supportedRetentionDays: number;
  policyWarnings: string[];
};

export const PROVIDER_AUDIENCE_MAPPINGS: Record<string, ProviderAudienceMapping> = {
  GOOGLE_ADS: {
    provider: "GOOGLE_ADS",
    providerAudienceType: "CUSTOMER_MATCH",
    minimumSizeRule: 1000,
    requiredIdentifierType: "HASHED_EMAIL_OR_PHONE",
    supportedRetentionDays: 540,
    policyWarnings: ["Customer Match requires hashed PII with consent.", "Not activated in Task 5.3."],
  },
  META: {
    provider: "META",
    providerAudienceType: "CUSTOM_AUDIENCE",
    minimumSizeRule: 100,
    requiredIdentifierType: "HASHED_EMAIL_OR_PHONE_OR_MAID",
    supportedRetentionDays: 180,
    policyWarnings: ["Custom audiences require consent basis.", "Special Ad Categories may apply."],
  },
  LINKEDIN: {
    provider: "LINKEDIN",
    providerAudienceType: "MATCHED_AUDIENCE",
    minimumSizeRule: 300,
    requiredIdentifierType: "HASHED_EMAIL",
    supportedRetentionDays: 180,
    policyWarnings: ["Matched audiences require LinkedIn Page admin.", "B2B targeting policies apply."],
  },
  TIKTOK: {
    provider: "TIKTOK",
    providerAudienceType: "CUSTOM_AUDIENCE",
    minimumSizeRule: 1000,
    requiredIdentifierType: "HASHED_EMAIL_OR_PHONE",
    supportedRetentionDays: 180,
    policyWarnings: ["Custom audiences require advertiser account verification."],
  },
};

export function getProviderMapping(provider: string): ProviderAudienceMapping | null {
  return PROVIDER_AUDIENCE_MAPPINGS[provider] ?? null;
}

export function checkProviderEligibility(
  provider: string,
  eligibleCount: number,
  retargetingWindowDays?: number | null,
): { eligible: boolean; warnings: string[]; errors: string[] } {
  const mapping = getProviderMapping(provider);
  if (!mapping) {
    return { eligible: false, warnings: [], errors: [`Unknown provider: ${provider}`] };
  }

  const warnings = [...mapping.policyWarnings];
  const errors: string[] = [];

  if (eligibleCount < mapping.minimumSizeRule) {
    errors.push(
      `Eligible count ${eligibleCount} is below provider minimum of ${mapping.minimumSizeRule}.`,
    );
  }

  if (eligibleCount < MIN_AUDIENCE_SIZE_DEFAULT) {
    warnings.push(`Count below platform-recommended minimum of ${MIN_AUDIENCE_SIZE_DEFAULT}.`);
  }

  if (
    retargetingWindowDays &&
    retargetingWindowDays > mapping.supportedRetentionDays
  ) {
    errors.push(
      `Retargeting window ${retargetingWindowDays}d exceeds provider maximum of ${mapping.supportedRetentionDays}d.`,
    );
  }

  warnings.push("Mapping is preparatory only — audience not activated externally.");

  return { eligible: errors.length === 0, warnings, errors };
}
