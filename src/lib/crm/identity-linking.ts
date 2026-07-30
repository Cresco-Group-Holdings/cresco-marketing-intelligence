import { DETERMINISTIC_IDENTITY_LINK_TYPES, PROHIBITED_MERGE_EVIDENCE } from "./constants";

export type IdentityLinkInput = {
  linkType: string;
  externalId: string;
  evidence?: string;
  verified?: boolean;
};

export function validateIdentityLink(input: IdentityLinkInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!(DETERMINISTIC_IDENTITY_LINK_TYPES as readonly string[]).includes(input.linkType)) {
    errors.push(`Invalid link type: ${input.linkType}`);
  }
  if (!input.externalId?.trim()) {
    errors.push("External ID is required.");
  }
  for (const prohibited of PROHIBITED_MERGE_EVIDENCE) {
    if (input.evidence?.toLowerCase().includes(prohibited)) {
      errors.push(`Prohibited evidence type: ${prohibited}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function canAutoLink(input: IdentityLinkInput): boolean {
  const autoLinkTypes = ["AUTH_USER", "VERIFIED_EMAIL", "CONFIRMED_PHONE", "STRIPE_CUSTOMER", "MARKETING_LEAD"];
  return autoLinkTypes.includes(input.linkType) && input.verified !== false;
}
