import type { AdvertisingAudienceDataSource } from "@prisma/client";

export type ConsentPolicyInput = {
  marketingConsentRequired: boolean;
  dataSources: AdvertisingAudienceDataSource[];
  retentionDays?: number | null;
  permittedPurpose?: string | null;
  customerListEligible: boolean;
  deletionExcluded: boolean;
  geoRestrictions?: string[];
  humanBridgeSafeguards?: boolean;
};

export type IdentityRecord = {
  marketingOptIn: boolean;
  retentionStatus: string;
  suppressed: boolean;
  deleted: boolean;
  country?: string | null;
};

export function isIdentityEligibleForAudience(
  identity: IdentityRecord,
  policy: ConsentPolicyInput,
): { eligible: boolean; reason?: string } {
  if (identity.deleted || identity.retentionStatus === "DELETED") {
    return { eligible: false, reason: "Identity is deleted." };
  }
  if (identity.suppressed || identity.retentionStatus === "SUPPRESSED") {
    return { eligible: false, reason: "Identity is suppressed." };
  }
  if (policy.deletionExcluded && identity.retentionStatus === "DELETED") {
    return { eligible: false, reason: "Deletion exclusion policy applies." };
  }
  if (policy.marketingConsentRequired && !identity.marketingOptIn) {
    return { eligible: false, reason: "Marketing consent not granted." };
  }
  if (policy.geoRestrictions?.length && identity.country) {
    if (policy.geoRestrictions.includes(identity.country)) {
      return { eligible: false, reason: `Geographic restriction: ${identity.country}` };
    }
  }
  if (policy.customerListEligible === false && policy.dataSources.includes("CRM")) {
    return { eligible: false, reason: "Customer list not eligible for this audience purpose." };
  }
  return { eligible: true };
}

export function countEligibleIdentities(
  identities: IdentityRecord[],
  policy: ConsentPolicyInput,
): { eligible: number; excluded: number; consentCovered: number } {
  let eligible = 0;
  let excluded = 0;
  let consentCovered = 0;

  for (const identity of identities) {
    const result = isIdentityEligibleForAudience(identity, policy);
    if (result.eligible) {
      eligible++;
      if (identity.marketingOptIn) consentCovered++;
    } else {
      excluded++;
    }
  }

  return { eligible, excluded, consentCovered };
}
