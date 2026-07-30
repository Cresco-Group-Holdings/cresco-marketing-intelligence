import type { RevenueCustomerLinkMethod } from "@prisma/client";

export type CustomerMappingInput = {
  internalUserId?: string | null;
  stripeMetadataUserId?: string | null;
  crmId?: string | null;
  confirmedIdentityId?: string | null;
  serverSideAssociationId?: string | null;
};

export type CustomerMappingResult = {
  identityId: string | null;
  linkMethod: RevenueCustomerLinkMethod | null;
  evidence: Record<string, unknown>;
  confidence: number;
};

const FORBIDDEN_METHODS = ["name_similarity", "fuzzy_match", "email_guess"];

export function mapCustomerToIdentity(
  input: CustomerMappingInput,
  identityLookup: (type: string, value: string) => string | null,
): CustomerMappingResult {
  if (input.confirmedIdentityId) {
    return {
      identityId: input.confirmedIdentityId,
      linkMethod: "CRM_ID_CONFIRMED",
      evidence: { confirmedIdentityId: input.confirmedIdentityId },
      confidence: 1,
    };
  }

  if (input.serverSideAssociationId) {
    const id = identityLookup("USER_ID", input.serverSideAssociationId);
    if (id) {
      return {
        identityId: id,
        linkMethod: "SERVER_SIDE_ASSOCIATION",
        evidence: { associationId: input.serverSideAssociationId },
        confidence: 0.98,
      };
    }
  }

  if (input.internalUserId) {
    const id = identityLookup("USER_ID", input.internalUserId);
    if (id) {
      return {
        identityId: id,
        linkMethod: "INTERNAL_CUSTOMER_ID",
        evidence: { internalUserId: input.internalUserId },
        confidence: 0.95,
      };
    }
  }

  if (input.stripeMetadataUserId) {
    const id = identityLookup("USER_ID", input.stripeMetadataUserId);
    if (id) {
      return {
        identityId: id,
        linkMethod: "STRIPE_METADATA",
        evidence: { metadataUserId: input.stripeMetadataUserId },
        confidence: 0.9,
      };
    }
  }

  if (input.crmId) {
    const id = identityLookup("PROVIDER_ID", input.crmId);
    if (id) {
      return {
        identityId: id,
        linkMethod: "CRM_ID_CONFIRMED",
        evidence: { crmId: input.crmId },
        confidence: 0.92,
      };
    }
  }

  return { identityId: null, linkMethod: null, evidence: {}, confidence: 0 };
}

export function isForbiddenMappingMethod(method: string): boolean {
  return FORBIDDEN_METHODS.includes(method.toLowerCase());
}
