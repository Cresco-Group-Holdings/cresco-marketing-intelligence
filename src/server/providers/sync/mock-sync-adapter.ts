import { createHash } from "node:crypto";
import type { SyncResourceType } from "@/lib/integrations/sync/constants";
import { MAX_SYNC_PAGE_SIZE } from "@/lib/integrations/sync/constants";
import type { CanonicalSyncRecord, SyncPageResult } from "@/lib/integrations/sync/types";

function checksum(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function mockCampaign(providerKey: string, index: number): CanonicalSyncRecord {
  const externalId = `${providerKey}_campaign_${index}`;
  return {
    resourceType: "campaign",
    externalId,
    name: `${providerKey} Campaign ${index}`,
    status: index % 3 === 0 ? "PAUSED" : "ACTIVE",
    currency: "USD",
    timezone: "UTC",
    sourceUpdatedAt: new Date().toISOString(),
    checksum: checksum({ externalId, index }),
  };
}

function mockMetrics(providerKey: string, dayOffset: number): CanonicalSyncRecord {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - dayOffset);
  const externalId = `${providerKey}_metrics_${date.toISOString().slice(0, 10)}`;
  return {
    resourceType: "metric_daily",
    externalId,
    occurredAt: date.toISOString(),
    granularity: "DAY",
    currency: "USD",
    timezone: "UTC",
    metrics: {
      impressions: 1000 + dayOffset * 50,
      clicks: 80 + dayOffset * 3,
      spend: 120.5 + dayOffset,
      conversions: 5 + (dayOffset % 3),
      reach: 900 + dayOffset * 40,
      engagement: 40 + dayOffset,
    },
    sourceUpdatedAt: new Date().toISOString(),
    checksum: checksum({ externalId, dayOffset }),
  };
}

function mockAccount(providerKey: string): CanonicalSyncRecord {
  return {
    resourceType: "provider_account",
    externalId: `${providerKey}_account_1`,
    name: `${providerKey} account`,
    currency: "USD",
    timezone: "UTC",
    sourceUpdatedAt: new Date().toISOString(),
  };
}

function mockContact(providerKey: string, index: number): CanonicalSyncRecord {
  return {
    resourceType: "contact",
    externalId: `${providerKey}_contact_${index}`,
    email: `contact${index}@example.com`,
    firstName: `Contact`,
    lastName: `${index}`,
    sourceUpdatedAt: new Date().toISOString(),
  };
}

function mockEmailCampaign(providerKey: string, index: number): CanonicalSyncRecord {
  return {
    resourceType: "email_campaign",
    externalId: `${providerKey}_email_${index}`,
    name: `${providerKey} Newsletter ${index}`,
    status: "SENT",
    sentAt: new Date().toISOString(),
    metrics: { opens: 120, clicks: 30, bounces: 2 },
    sourceUpdatedAt: new Date().toISOString(),
  };
}

function mockSocialPost(providerKey: string, index: number): CanonicalSyncRecord {
  return {
    resourceType: "social_post",
    externalId: `${providerKey}_post_${index}`,
    message: `Sample post ${index}`,
    publishedAt: new Date().toISOString(),
    metrics: { impressions: 500, engagement: 25, clicks: 10 },
    sourceUpdatedAt: new Date().toISOString(),
  };
}

export function generateMockSyncPage(input: {
  providerKey: string;
  resourceType: SyncResourceType;
  cursor?: string;
  pageSize?: number;
  dateRange?: { start: Date; end: Date };
}): SyncPageResult {
  const page = Number.parseInt(input.cursor ?? "0", 10) || 0;
  const pageSize = input.pageSize ?? MAX_SYNC_PAGE_SIZE;
  const records: CanonicalSyncRecord[] = [];

  if (input.resourceType === "provider_account") {
    if (page === 0) records.push(mockAccount(input.providerKey));
  } else if (input.resourceType === "campaign") {
    for (let i = 0; i < Math.min(pageSize, 3); i += 1) {
      records.push(mockCampaign(input.providerKey, page * pageSize + i + 1));
    }
  } else if (input.resourceType === "metric_daily") {
    const days = Math.min(pageSize, 7);
    for (let i = 0; i < days; i += 1) {
      records.push(mockMetrics(input.providerKey, page * days + i));
    }
  } else if (input.resourceType === "contact") {
    for (let i = 0; i < Math.min(pageSize, 5); i += 1) {
      records.push(mockContact(input.providerKey, page * pageSize + i + 1));
    }
  } else if (input.resourceType === "email_campaign" || input.resourceType === "email_performance") {
    for (let i = 0; i < Math.min(pageSize, 2); i += 1) {
      records.push(mockEmailCampaign(input.providerKey, page * pageSize + i + 1));
    }
  } else if (input.resourceType === "social_post" || input.resourceType === "content_performance") {
    for (let i = 0; i < Math.min(pageSize, 3); i += 1) {
      records.push(mockSocialPost(input.providerKey, page * pageSize + i + 1));
    }
  } else {
    records.push({
      resourceType: input.resourceType,
      externalId: `${input.providerKey}_${input.resourceType}_${page + 1}`,
      payload: { mock: true },
      sourceUpdatedAt: new Date().toISOString(),
    });
  }

  const hasMore = page < 1 && ["campaign", "metric_daily", "contact"].includes(input.resourceType);
  return {
    records,
    nextCursor: hasMore ? String(page + 1) : undefined,
    warnings: records.length === 0 ? [`No ${input.resourceType} records returned.`] : undefined,
  };
}
