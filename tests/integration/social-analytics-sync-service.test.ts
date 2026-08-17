import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  socialMetricDefinition: { upsert: vi.fn() },
  socialAnalyticsSync: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  socialAccount: { findFirst: vi.fn() },
  socialMetricSnapshot: { findUnique: vi.fn(), create: vi.fn() },
  socialPostMetric: { createMany: vi.fn() },
  socialAccountMetric: { createMany: vi.fn() },
  socialAnalyticsError: { create: vi.fn() },
  publishingJob: { findMany: vi.fn() },
}));
const credentials = vi.hoisted(() => ({ readTokens: vi.fn() }));
const analyticsCredentials = vi.hoisted(() => ({
  refreshForAnalytics: vi.fn(),
  markReconnectRequired: vi.fn(),
}));
const adapter = vi.hoisted(() => ({
  provider: "INSTAGRAM",
  historicalBackfill: { supported: true, limitation: "test" },
  fetchPostMetrics: vi.fn(),
  fetchAccountMetrics: vi.fn(),
  discoverPosts: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: credentials,
}));
vi.mock("@/server/services/social-analytics-credential-service", () => ({
  socialAnalyticsCredentialService: analyticsCredentials,
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

function sync(overrides: Record<string, unknown> = {}) {
  return {
    id: "sync-1",
    organisationId: "org-1",
    projectId: "project-1",
    brandId: "brand-1",
    socialAccountId: "account-1",
    provider: "INSTAGRAM",
    status: "QUEUED",
    syncType: "INCREMENTAL",
    cursor: null,
    attemptCount: 0,
    maxAttempts: 3,
    refreshAttemptCount: 0,
    recoveryCount: 0,
    maxRecoveries: 3,
    postsProcessed: 0,
    metricsStored: 0,
    unavailableMetrics: [],
    backfillCompleted: false,
    backfillFrom: null,
    backfillTo: null,
    startedAt: null,
    workerId: null,
    leaseExpiresAt: null,
    nextRetryAt: null,
    ...overrides,
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
    socialConnection: {
      id: "connection-1",
      organisationId: "org-1",
      brandId: "brand-1",
    },
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

/** Makes `claim()` succeed by returning the same row before and after the compare-and-swap. */
function stageSync(row: Record<string, unknown>) {
  prisma.socialAnalyticsSync.findUnique.mockResolvedValue(row);
  prisma.socialAnalyticsSync.updateMany.mockResolvedValue({ count: 1 });
}

describe("socialAnalyticsSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    credentials.readTokens.mockResolvedValue({
      accessToken: "token",
      refreshToken: "refresh",
    });
    prisma.socialAnalyticsSync.update.mockResolvedValue({});
    prisma.socialAnalyticsSync.updateMany.mockResolvedValue({ count: 1 });
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
    adapter.discoverPosts.mockResolvedValue({ posts: [], hasMore: false });
    adapter.historicalBackfill = { supported: true, limitation: "test" };
  });

  it("enqueues an initial or incremental sync idempotently", async () => {
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    prisma.socialAnalyticsSync.upsert.mockResolvedValue({ id: "sync-1" });
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
    const call = prisma.socialAnalyticsSync.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ idempotencyKey: "analytics-sync-1" });
    // An initial sync requests a historical backfill window.
    expect(call.create.backfillFrom).toBeInstanceOf(Date);
    expect(call.create.backfillTo).toBeInstanceOf(Date);
  });

  it("selects due queued work and expired RUNNING leases together", async () => {
    prisma.socialAnalyticsSync.findMany.mockResolvedValue([]);
    expect(await socialAnalyticsSyncService.processDue(5)).toEqual([]);
    const where = prisma.socialAnalyticsSync.findMany.mock.calls[0]![0].where;
    expect(where.OR[0].status).toEqual({ in: ["QUEUED", "PARTIAL"] });
    expect(where.OR[1]).toMatchObject({ status: "RUNNING" });
    expect(where.OR[1].leaseExpiresAt.lt).toBeInstanceOf(Date);
  });

  it("stores provider-returned post and account observations", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(result).toMatchObject({
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
            discoverySource: "PLATFORM_PUBLISHING",
          }),
        ],
      }),
    );
  });

  it("takes an exclusive lease and refuses a second concurrent worker", async () => {
    prisma.socialAnalyticsSync.findUnique.mockResolvedValue(sync());
    // The compare-and-swap loses the race, so the second worker must not run the sync.
    prisma.socialAnalyticsSync.updateMany.mockResolvedValue({ count: 0 });
    expect(await socialAnalyticsSyncService.process("sync-1", "worker-b")).toBeNull();
    expect(adapter.fetchAccountMetrics).not.toHaveBeenCalled();
  });

  it("refuses to claim a RUNNING sync whose lease is still valid", async () => {
    prisma.socialAnalyticsSync.findUnique.mockResolvedValue(
      sync({
        status: "RUNNING",
        workerId: "worker-a",
        leaseExpiresAt: new Date(Date.now() + 120_000),
      }),
    );
    expect(await socialAnalyticsSyncService.process("sync-1", "worker-b")).toBeNull();
    expect(prisma.socialAnalyticsSync.updateMany).not.toHaveBeenCalled();
  });

  it("reclaims a RUNNING sync whose lease expired and resumes from the cursor", async () => {
    stageSync(
      sync({
        status: "RUNNING",
        workerId: "dead-worker",
        leaseExpiresAt: new Date(Date.now() - 60_000),
        cursor: { posts: "cursor-7", account: "cursor-a" },
        postsProcessed: 3,
        metricsStored: 9,
      }),
    );
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-b");
    expect(result).toMatchObject({ recovered: true, postsProcessed: 4 });
    // The claim counts as a recovery, not a fresh attempt.
    const claim = prisma.socialAnalyticsSync.updateMany.mock.calls[0]![0];
    expect(claim.data.recoveryCount).toEqual({ increment: 1 });
    expect(claim.data.attemptCount).toEqual({ increment: 0 });
    expect(adapter.fetchPostMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "cursor-7" }),
    );
  });

  it("fails terminally once the recovery budget is exhausted", async () => {
    prisma.socialAnalyticsSync.findUnique.mockResolvedValue(
      sync({
        status: "RUNNING",
        workerId: "dead-worker",
        leaseExpiresAt: new Date(Date.now() - 60_000),
        recoveryCount: 3,
        maxRecoveries: 3,
      }),
    );
    expect(await socialAnalyticsSyncService.process("sync-1", "worker-b")).toBeNull();
    expect(prisma.socialAnalyticsSync.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
    expect(prisma.socialAnalyticsError.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: "TERMINAL", terminal: true }),
      }),
    );
  });

  it("persists the cursor inside the post loop rather than only at the end", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchPostMetrics.mockResolvedValue({
      observations: [observation("impressions", 50)],
      unavailableMetrics: [],
      cursor: "after-post-1",
      raw: {},
    });
    await socialAnalyticsSyncService.process("sync-1", "worker-a");
    const heartbeats = prisma.socialAnalyticsSync.updateMany.mock.calls.filter(
      ([call]) => call.data.cursor?.posts === "after-post-1",
    );
    expect(heartbeats.length).toBeGreaterThan(0);
    expect(heartbeats[0]![0].data.leaseExpiresAt).toBeInstanceOf(Date);
  });

  it("prevents duplicate snapshots when a worker retries", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    prisma.socialMetricSnapshot.findUnique.mockResolvedValue({ id: "existing" });
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(result).toMatchObject({ metricsStored: 0 });
    expect(adapter.fetchPostMetrics).not.toHaveBeenCalled();
    expect(prisma.socialPostMetric.createMany).not.toHaveBeenCalled();
  });

  it("records deleted posts without fabricating zero metrics", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchPostMetrics.mockRejectedValue(
      new SocialAnalyticsProviderError("DELETED_POST", "Deleted", false),
    );
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(result).toMatchObject({ status: "PARTIAL", postsProcessed: 1 });
    expect(prisma.socialPostMetric.createMany).not.toHaveBeenCalled();
    expect(prisma.socialAnalyticsError.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "DELETED_POST",
          providerPostId: "post-1",
          syncPhase: "POST_METRICS",
        }),
      }),
    );
  });

  it("reports unavailable metrics rather than substituting values", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchPostMetrics.mockResolvedValue({
      observations: [],
      unavailableMetrics: ["reach"],
      raw: {},
    });
    await socialAnalyticsSyncService.process("sync-1", "worker-a");
    const release = prisma.socialAnalyticsSync.updateMany.mock.calls.at(-1)![0];
    expect(release.data.unavailableMetrics).toContain("reach");
  });

  it("flags providers without historical backfill instead of implying coverage", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.historicalBackfill = { supported: false, limitation: "none" };
    await socialAnalyticsSyncService.process("sync-1", "worker-a");
    const release = prisma.socialAnalyticsSync.updateMany.mock.calls.at(-1)![0];
    expect(release.data.unavailableMetrics).toContain("historicalBackfill:INSTAGRAM");
    expect(adapter.discoverPosts).not.toHaveBeenCalled();
  });

  it("merges provider history with platform posts and keeps platform attribution", async () => {
    stageSync(sync({ syncType: "INITIAL" }));
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.discoverPosts.mockResolvedValue({
      posts: [
        { providerPostId: "post-1", publishedAt: new Date("2026-06-01T00:00:00Z") },
        { providerPostId: "history-only", publishedAt: new Date("2026-06-02T00:00:00Z") },
      ],
      hasMore: false,
    });
    await socialAnalyticsSyncService.process("sync-1", "worker-a");
    const written = prisma.socialPostMetric.createMany.mock.calls.map(
      ([call]) => call.data[0],
    );
    const platform = written.find((row) => row.providerPostId === "post-1");
    const history = written.find((row) => row.providerPostId === "history-only");
    // The overlapping ID keeps its content link and platform provenance.
    expect(platform).toMatchObject({
      contentItemId: "content-1",
      discoverySource: "PLATFORM_PUBLISHING",
    });
    expect(history).toMatchObject({ discoverySource: "PROVIDER_HISTORY" });
    expect(history?.contentItemId).toBeUndefined();
  });

  it("persists rate limits with a retry time and cursor", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchAccountMetrics.mockRejectedValue(
      new SocialAnalyticsProviderError("RATE_LIMITED", "Limited", true),
    );
    expect(await socialAnalyticsSyncService.process("sync-1", "worker-a")).toMatchObject({
      status: "PARTIAL",
    });
    const release = prisma.socialAnalyticsSync.updateMany.mock.calls.at(-1)![0];
    expect(release.data.status).toBe("PARTIAL");
    expect(release.data.nextRetryAt).toBeInstanceOf(Date);
  });

  it("keeps successful observations when a later post fails", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    prisma.publishingJob.findMany.mockResolvedValue([
      { ...publishedJob(), providerUploadState: { postIds: ["post-1", "post-2"] } },
    ]);
    adapter.fetchPostMetrics
      .mockResolvedValueOnce({
        observations: [observation("impressions", 10)],
        unavailableMetrics: [],
        raw: {},
      })
      .mockRejectedValueOnce(
        new SocialAnalyticsProviderError("PROVIDER_ERROR", "Broken", false),
      );
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(result).toMatchObject({ status: "PARTIAL", postsProcessed: 1 });
    expect(prisma.socialPostMetric.createMany).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired credential once and requeues with the cursor intact", async () => {
    stageSync(sync({ cursor: { posts: "resume-here" } }));
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchAccountMetrics.mockRejectedValue(
      new SocialAnalyticsProviderError("TOKEN_EXPIRED", "Expired", true),
    );
    analyticsCredentials.refreshForAnalytics.mockResolvedValue({
      status: "REFRESHED",
      tokens: { accessToken: "fresh" },
    });
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(result).toMatchObject({ status: "REQUEUED_AFTER_REFRESH" });
    const release = prisma.socialAnalyticsSync.updateMany.mock.calls.at(-1)![0];
    expect(release.data).toMatchObject({
      status: "QUEUED",
      refreshAttemptCount: { increment: 1 },
    });
    expect(release.data.cursor).toEqual({ posts: "resume-here" });
  });

  it("treats a second expiry as terminal and requires a reconnect", async () => {
    stageSync(sync({ refreshAttemptCount: 1 }));
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchAccountMetrics.mockRejectedValue(
      new SocialAnalyticsProviderError("TOKEN_EXPIRED", "Expired", true),
    );
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(result).toMatchObject({ status: "FAILED" });
    expect(analyticsCredentials.refreshForAnalytics).not.toHaveBeenCalled();
    expect(analyticsCredentials.markReconnectRequired).toHaveBeenCalledWith(
      expect.objectContaining({ socialConnectionId: "connection-1", organisationId: "org-1" }),
    );
  });

  it("fails terminally when the provider credential cannot be refreshed", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    adapter.fetchAccountMetrics.mockRejectedValue(
      new SocialAnalyticsProviderError("TOKEN_EXPIRED", "Expired", true),
    );
    analyticsCredentials.refreshForAnalytics.mockResolvedValue({
      status: "RECONNECT_REQUIRED",
      reason: "No refresh token is stored.",
    });
    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(result).toMatchObject({ status: "FAILED" });
    const release = prisma.socialAnalyticsSync.updateMany.mock.calls.at(-1)![0];
    expect(release.data.lastError).toBe("No refresh token is stored.");
  });

  it("rejects cross-tenant social account access", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account({ organisationId: "org-2" }));
    await expect(socialAnalyticsSyncService.process("sync-1", "worker-a")).rejects.toThrow(
      "outside the tenant scope",
    );
    expect(credentials.readTokens).not.toHaveBeenCalled();
  });

  it("rejects an account whose connection belongs to another tenant", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(
      account({
        socialConnection: { id: "connection-1", organisationId: "org-2", brandId: "brand-9" },
      }),
    );
    await expect(socialAnalyticsSyncService.process("sync-1", "worker-a")).rejects.toThrow(
      "outside the tenant scope",
    );
  });

  it("skips publication-backed publishing jobs without a content schedule", async () => {
    stageSync(sync());
    prisma.socialAccount.findFirst.mockResolvedValue(account());
    prisma.publishingJob.findMany.mockResolvedValue([
      {
        id: "job-pub",
        publishedMediaId: "orphan-post",
        providerUploadState: null,
        schedule: null,
      },
      publishedJob(),
    ]);

    const result = await socialAnalyticsSyncService.process("sync-1", "worker-a");

    expect(result.status).toBe("COMPLETED");
    expect(adapter.fetchPostMetrics).toHaveBeenCalledTimes(1);
    expect(adapter.fetchPostMetrics.mock.calls[0]![0].providerPostId).toBe("post-1");
  });

  it("collects every X thread post ID independently", async () => {
    stageSync(sync({ provider: "X" }));
    prisma.socialAccount.findFirst.mockResolvedValue(account({ provider: "X" }));
    adapter.provider = "X";
    prisma.publishingJob.findMany.mockResolvedValue([
      {
        ...publishedJob(),
        providerUploadState: { postIds: ["post-1", "post-2", "post-3"] },
      },
    ]);
    await socialAnalyticsSyncService.process("sync-1", "worker-a");
    expect(adapter.fetchPostMetrics).toHaveBeenCalledTimes(3);
    adapter.provider = "INSTAGRAM";
  });
});
