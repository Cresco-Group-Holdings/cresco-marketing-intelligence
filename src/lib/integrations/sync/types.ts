import type { ProviderCampaignMappingPolicy, ProviderSyncMode } from "@prisma/client";
import type { SyncResourceType } from "@/lib/integrations/sync/constants";

export type CanonicalMetricRecord = {
  resourceType: "metric_daily";
  externalId: string;
  externalCampaignId?: string;
  occurredAt: string;
  granularity: "DAY" | "HOUR" | "TOTAL";
  currency?: string;
  timezone?: string;
  metrics: Record<string, number>;
  dimensions?: Record<string, string>;
  sourceUpdatedAt?: string;
  checksum?: string;
};

export type CanonicalCampaignRecord = {
  resourceType: "campaign";
  externalId: string;
  name: string;
  status: string;
  currency?: string;
  timezone?: string;
  startDate?: string;
  endDate?: string;
  sourceUpdatedAt?: string;
  checksum?: string;
};

export type CanonicalAccountRecord = {
  resourceType: "provider_account";
  externalId: string;
  name: string;
  currency?: string;
  timezone?: string;
  sourceUpdatedAt?: string;
};

export type CanonicalContactRecord = {
  resourceType: "contact";
  externalId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyExternalId?: string;
  sourceUpdatedAt?: string;
};

export type CanonicalEmailCampaignRecord = {
  resourceType: "email_campaign";
  externalId: string;
  name: string;
  status: string;
  sentAt?: string;
  metrics?: Record<string, number>;
  sourceUpdatedAt?: string;
};

export type CanonicalSocialPostRecord = {
  resourceType: "social_post";
  externalId: string;
  message?: string;
  publishedAt?: string;
  metrics?: Record<string, number>;
  sourceUpdatedAt?: string;
};

export type CanonicalSyncRecord =
  | CanonicalMetricRecord
  | CanonicalCampaignRecord
  | CanonicalAccountRecord
  | CanonicalContactRecord
  | CanonicalEmailCampaignRecord
  | CanonicalSocialPostRecord
  | {
      resourceType: SyncResourceType;
      externalId: string;
      payload: Record<string, unknown>;
      sourceUpdatedAt?: string;
      checksum?: string;
    };

export type SyncPageResult = {
  records: CanonicalSyncRecord[];
  nextCursor?: string;
  partialFailure?: boolean;
  warnings?: string[];
};

export type SyncRunRequest = {
  connectionId: string;
  organisationId: string;
  providerKey: string;
  syncMode: ProviderSyncMode;
  resourceTypes: SyncResourceType[];
  dateRange?: { start: Date; end: Date };
  correlationId?: string;
  triggeredByUserId?: string;
  retryFailureIds?: string[];
};

export type CampaignMappingReview = {
  externalResourceId: string;
  externalName: string;
  mappingPolicy: ProviderCampaignMappingPolicy;
  internalCampaignId?: string;
  requiresReview: boolean;
};
