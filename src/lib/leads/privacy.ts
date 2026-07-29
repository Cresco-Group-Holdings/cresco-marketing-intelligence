import type { LeadRetentionStatus } from "@prisma/client";

export type LeadPrivacyRecord = {
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobRole?: string | null;
  country?: string | null;
  providerUsername?: string | null;
  providerProfileUrl?: string | null;
  expressedInterest?: string | null;
  originalInteraction?: string | null;
};

/** Returns only fields that are necessary for the requested export scope. */
export function minimiseLeadExport(record: LeadPrivacyRecord, scope: "FULL" | "CRM" | "SUMMARY") {
  const base = {
    displayName: record.displayName ?? undefined,
    country: record.country ?? undefined,
    company: record.company ?? undefined,
    jobRole: record.jobRole ?? undefined,
    expressedInterest: record.expressedInterest ?? undefined,
  };

  if (scope === "SUMMARY") {
    return base;
  }

  if (scope === "CRM") {
    return {
      ...base,
      email: record.email ?? undefined,
      phone: record.phone ?? undefined,
      providerUsername: record.providerUsername ?? undefined,
      providerProfileUrl: record.providerProfileUrl ?? undefined,
    };
  }

  return {
    ...base,
    email: record.email ?? undefined,
    phone: record.phone ?? undefined,
    providerUsername: record.providerUsername ?? undefined,
    providerProfileUrl: record.providerProfileUrl ?? undefined,
    originalInteraction: record.originalInteraction ?? undefined,
  };
}

export function canMarketToLead(input: {
  retentionStatus: LeadRetentionStatus;
  marketingOptIn: boolean;
  suppressed: boolean;
}): boolean {
  if (input.retentionStatus === "DELETED" || input.retentionStatus === "SUPPRESSED") {
    return false;
  }
  if (input.suppressed) {
    return false;
  }
  return input.marketingOptIn;
}

export function redactDeletedLead(): LeadPrivacyRecord {
  return {
    displayName: "[deleted]",
    email: null,
    phone: null,
    company: null,
    jobRole: null,
    country: null,
    providerUsername: null,
    providerProfileUrl: null,
    expressedInterest: null,
    originalInteraction: null,
  };
}
