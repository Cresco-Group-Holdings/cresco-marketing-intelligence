import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  socialMetricDefinition: { upsert: vi.fn() },
  socialAnalyticsSync: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  socialAccount: { findFirst: vi.fn() },
  socialMetricSnapshot: { findUnique: vi.fn(), create: vi.fn() },
  socialPostMetric: { createMany: vi.fn() },
  socialAccountMetric: { createMany: vi.fn() },
  socialAnalyticsError: { create: vi.fn() },
  publishingJob: { findMany: vi.fn() },
}));
const credentials = vi.hoisted(() => ({ readTokens: vi.fn() }));
const adapter = vi.hoisted(() => ({
  fetchPostMetrics: vi.fn(),
  fetchAccountMetrics: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: credentials,
}));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }),
  },
}));
vi.mock("@/lib/social/analytics-adapters", async (original) => {
  const actual = await original<typeof import("@/lib/social/analytics-adapters")>();
  return {
    ...actual,
    getSocialAnalyticsAdapter: () => adapter,
  };
});

import { SocialAnalyticsProviderError } from "@/lib/social/analytics-adapters";
import { socialAnalyticsSyncService } from "@/server/services/social-analytics-sync-service";

const context = {
  organisationId: "org-1",
  userProfileId: "user-1",
} as never;

const observation = (metricType: string, metricValue: number) => ({
  metricType,
  metricValue,
  measuredAt: new Date("2026-07-29T12:00:00Z"),
  metricPeriod: "LIFETIME",
  sourceField: metricType,
});

function sync() {
  return {
    id: "sync-1",
    organisationId: "org-1",
    projectId: "project-1",
    brandId: "brand-1",
    socialAccountId: "account-1",
    provider: "INSTAGRAM",
    status: "QUEUED",
    cursor: null,
    attemptCount: 0,
  };
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    organisationId: "org-1",
    brandId: "brand-1",
    provider: "INSTAGRAM",
    providerAccountId: "ig-account",
    socialConnectionId: "connection-1",
    ...overrides,
  };
}

function publishedJob() {
  return {
    id: "job-1",
    publishedMediaId: "post-1",
    providerUploadState: null,
    schedule: {
      contentItemId: "content-1",
      contentVariantId: "variant-1",
      contentItem: { id: "content-1" },
      contentVariant: { id: "variant-1" },
    },
  };
}

describe("socialAnalyticsSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    credentials.readTokens.mockResolvedValue({
      accessToken: "token",
    });
    prisma.socialAnalyticsSync.update.mockResolvedValue({});
    prisma.socialMetricSnapshot.findUnique.mockResolvedValue(null);
    prisma.socialMetricSnapshot.create.mockResolvedValue({});
    prisma.socialPostMetric.createMany.mockResolvedValue({ count: 1 });
    prisma.socialAccountMetric.createMany.mockResolvedValue({ count: 1 });
    prisma.socialAnalyticsError.create.mockResolvedValue({});
    prisma.publishingJob.findMany.mockResolvedValue([publishedJob()]);
    adapter.fetchAccountMetrics.mockResolvedValue({
      observations: [observation("follows", 100)],
      unavailableMetrics: [],
      raw: { follower_count: 100 },
    });
    adapter.fetchPostMetrics.mockResolvedValue({
      observations: [observation("impressions", 50)],
      unavailableMetrics: [],
      raw: { impressions: 50 },
    });
  });

  it("enqueues an initial or incremental sync idempotently", async () => {
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    prisma.socialAnalyticsSync.upsert.mockResolvedValue({
      id: "sync-1",
    });
    const result = await socialAnalyticsSyncService.enqueue(
      "brand-1",
      "org-1",
      {
        socialAccountId: "account-1",
        syncType: "INITIAL",
        idempotencyKey: "analytics-sync-1",
      },
      context,
    );
    expect(result).toEqual({ id: "sync-1" });
    expect(prisma.socialAnalyticsSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: "analytics-sync-1" },
      }),
    );
  });

  it("processes scheduled refreshes only when due", async () => {
    prisma.socialAnalyticsSync.findMany.mockResolvedValue([]);
    expect(await socialAnalyticsSyncService.processDue(5)).toEqual([]);
    expect(prisma.socialAnalyticsSync.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["QUEUED", "PARTIAL"] },
        }),
        take: 5,
      }),
    );
  });

  it("stores provider-returned post and account observations", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    const result = await socialAnalyticsSyncService.process("sync-1");
    expect(result).toEqual({
      status: "COMPLETED",
      postsProcessed: 1,
      metricsStored: 2,
    });
    expect(prisma.socialPostMetric.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            providerPostId: "post-1",
            metricType: "impressions",
            metricValue: 50,
          }),
        ],
      }),
    );
  });

  it("prevents duplicate snapshots when a worker retries", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    prisma.socialMetricSnapshot.findUnique.mockResolvedValue({
      id: "existing",
    });
    const result = await socialAnalyticsSyncService.process("sync-1");
    expect(result).toMatchObject({ metricsStored: 0 });
    expect(adapter.fetchPostMetrics).not.toHaveBeenCalled();
    expect(prisma.socialPostMetric.createMany).not.toHaveBeenCalled();
  });

  it("records deleted posts without fabricating zero metrics", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchPostMetrics.mockRejectedValue(
      new SocialAnalyticsProviderError("DELETED_POST", "Deleted", false),
    );
    const result = await socialAnalyticsSyncService.process("sync-1");
    expect(result).toMatchObject({
      status: "PARTIAL",
      postsProcessed: 1,
    });
    expect(prisma.socialPostMetric.createMany).not.toHaveBeenCalled();
    expect(prisma.socialAnalyticsError.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "DELETED_POST",
          providerPostId: "post-1",
        }),
      }),
    );
  });

  it("reports unavailable metrics rather than substituting values", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchPostMetrics.mockResolvedValue({
      observations: [],
      unavailableMetrics: ["reach"],
      raw: {},
    });
    await socialAnalyticsSyncService.process("sync-1");
    expect(prisma.socialAnalyticsSync.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unavailableMetrics: ["reach"],
        }),
      }),
    );
  });

  it("persists rate limits with a retry time and cursor", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchAccountMetrics.mockRejectedValue(
      new SocialAnalyticsProviderError("RATE_LIMITED", "Limited", true),
    );
    expect(await socialAnalyticsSyncService.process("sync-1")).toMatchObject({
      status: "PARTIAL",
    });
    expect(prisma.socialAnalyticsSync.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PARTIAL",
          nextRetryAt: expect.any(Date),
        }),
      }),
    );
  });

  it("rejects cross-tenant social account access", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account({ organisationId: "org-2" }));
    await expect(socialAnalyticsSyncService.process("sync-1")).rejects.toThrow(
      "outside the tenant scope",
    );
    expect(credentials.readTokens).not.toHaveBeenCalled();
  });

  it("collects every X thread post ID independently", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue({
      ...sync(),
      provider: "X",
    });
    prisma.socialAccount.findFirst.mockResolvedValue(account({ provider: "X" }));
    prisma.publishingJob.findMany.mockResolvedValue([
      {
        ...publishedJob(),
        providerUploadState: {
          postIds: ["post-1", "post-2", "post-3"],
        },
      },
    ]);
    await socialAnalyticsSyncService.process("sync-1");
    expect(adapter.fetchPostMetrics).toHaveBeenCalledTimes(3);
  });
});
