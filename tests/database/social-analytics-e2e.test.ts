import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  providerTransport,
  resetDatabase,
  type Tenant,
} from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

const INSIGHTS = /graph\.facebook\.com.*insights/;
const MEDIA = /graph\.facebook\.com.*\/media\?/;

const insightsBody = (impressions: number, reach?: number) => ({
  data: [
    { name: "impressions", values: [{ value: impressions }] },
    ...(reach === undefined ? [] : [{ name: "reach", values: [{ value: reach }] }]),
  ],
});

const accountBody = (followers: number) => ({
  data: [{ name: "follower_count", values: [{ value: followers }] }],
});

function stubProvider(routes: Parameters<typeof providerTransport>[0]) {
  const transport = providerTransport(routes);
  vi.stubGlobal("fetch", vi.fn(transport.stub));
  return transport;
}

/** Standard happy path: account insights, no provider history, one post's insights. */
function stubHappyPath(impressions = 120, followers = 900) {
  return stubProvider([
    { match: MEDIA, body: { data: [] } },
    { match: /insights\?metric=follower_count/, body: accountBody(followers) },
    { match: INSIGHTS, body: insightsBody(impressions, 80) },
  ]);
}

suite("social analytics against a real database", () => {
  let tenant: Tenant;

  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    await resetDatabase();
    tenant = await createTenant({ analyticsTimezone: "Europe/London" });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.$disconnect();
  });

  async function services() {
    const sync = await import("@/server/services/social-analytics-sync-service");
    const query = await import("@/server/services/social-analytics-query-service");
    const scheduler = await import("@/server/services/social-analytics-scheduler-service");
    return {
      syncService: sync.socialAnalyticsSyncService,
      queryService: query.socialAnalyticsQueryService,
      schedulerService: scheduler.socialAnalyticsSchedulerService,
    };
  }

  async function enqueue(overrides: Record<string, unknown> = {}) {
    const { syncService } = await services();
    return syncService.enqueue(
      tenant.brand.id,
      tenant.organisation.id,
      {
        socialAccountId: tenant.account.id,
        syncType: "INCREMENTAL",
        idempotencyKey: `manual-${tenant.id}-${Math.random().toString(36).slice(2, 10)}`,
        ...overrides,
      } as never,
      tenant.context as never,
    );
  }

  const rangeFilters = {
    from: new Date("2026-07-01T00:00:00Z"),
    to: new Date("2026-07-31T23:59:59Z"),
  };

  it("applies every migration and exposes the analytics schema", async () => {
    const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'SocialAnalyticsSync'`,
    );
    const names = columns.map((column) => column.column_name);
    for (const expected of [
      "heartbeatAt",
      "leaseExpiresAt",
      "workerId",
      "recoveryCount",
      "refreshAttemptCount",
      "backfillFrom",
      "backfillCompleted",
      "lastError",
    ]) {
      expect(names).toContain(expected);
    }
    const brandColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Brand' AND column_name = 'analyticsTimezone'`,
    );
    expect(brandColumns).toHaveLength(1);
  });

  it("runs enqueue → worker → persisted metrics → query → export", async () => {
    stubHappyPath();
    const { syncService, queryService } = await services();
    const sync = await enqueue();
    const result = await syncService.process(sync.id, "worker-1");
    expect(result).toMatchObject({ status: "COMPLETED", postsProcessed: 1 });

    const stored = await prisma.socialPostMetric.findMany({ orderBy: { metricType: "asc" } });
    expect(stored.map((row) => row.metricType)).toEqual(["impressions", "reach"]);
    expect(stored[0]?.contentItemId).toBe(tenant.contentItem.id);
    expect(Number(stored[0]?.metricValue)).toBe(120);
    expect(await prisma.socialAccountMetric.count()).toBe(1);

    const posts = await queryService.posts(
      tenant.brand.id,
      tenant.organisation.id,
      rangeFilters,
      tenant.context as never,
    );
    expect(posts).toHaveLength(2);
    expect(posts[0]?.attribution?.title).toBe(tenant.contentItem.title);

    const csv = await queryService.export(
      tenant.brand.id,
      tenant.organisation.id,
      rangeFilters,
      "POST",
      "CSV",
      tenant.context as never,
    );
    expect(csv.body).toContain("# timezone=Europe/London");
    expect(csv.body).toContain(tenant.providerPostId);

    const json = await queryService.export(
      tenant.brand.id,
      tenant.organisation.id,
      rangeFilters,
      "POST",
      "JSON",
      tenant.context as never,
    );
    const parsed = JSON.parse(json.body);
    expect(parsed.metadata.timezone).toBe("Europe/London");
    expect(parsed.rows).toHaveLength(2);

    const completed = await prisma.socialAnalyticsSync.findUniqueOrThrow({
      where: { id: sync.id },
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.workerId).toBeNull();
    expect(completed.leaseExpiresAt).toBeNull();
  });

  it("prevents duplicate snapshots and metric rows when the same sync runs twice", async () => {
    stubHappyPath();
    const { syncService } = await services();
    const sync = await enqueue();
    await syncService.process(sync.id, "worker-1");
    const firstCount = await prisma.socialPostMetric.count();

    await prisma.socialAnalyticsSync.update({
      where: { id: sync.id },
      data: { status: "QUEUED", attemptCount: 0, completedAt: null },
    });
    await syncService.process(sync.id, "worker-1");

    expect(await prisma.socialPostMetric.count()).toBe(firstCount);
    expect(await prisma.socialMetricSnapshot.count()).toBe(2);
  });

  it("reclaims a stale RUNNING sync and resumes from the persisted cursor", async () => {
    stubHappyPath();
    const { syncService } = await services();
    const sync = await enqueue();
    // Simulate a worker that died mid-run holding an expired lease.
    await prisma.socialAnalyticsSync.update({
      where: { id: sync.id },
      data: {
        status: "RUNNING",
        workerId: "dead-worker",
        startedAt: new Date(Date.now() - 600_000),
        heartbeatAt: new Date(Date.now() - 600_000),
        leaseExpiresAt: new Date(Date.now() - 300_000),
        cursor: { posts: "resume-cursor" },
        postsProcessed: 0,
      },
    });

    const due = await syncService.processDue(5, "worker-2");
    expect(due.map((item) => item.syncId)).toContain(sync.id);
    const recovered = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect(recovered.recoveryCount).toBe(1);
    expect(recovered.status).toBe("COMPLETED");
    expect(await prisma.socialPostMetric.count()).toBeGreaterThan(0);
  });

  it("does not let two workers claim the same sync", async () => {
    stubHappyPath();
    const { syncService } = await services();
    const sync = await enqueue();
    const [first, second] = await Promise.all([
      syncService.claim(sync.id, "worker-a"),
      syncService.claim(sync.id, "worker-b"),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const claimed = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect(["worker-a", "worker-b"]).toContain(claimed.workerId);
  });

  it("persists the discovery cursor and resumes backfill on the next pass", async () => {
    process.env.SOCIAL_ANALYTICS_BACKFILL_MAX_PAGES = "1";
    stubProvider([
      { match: /insights\?metric=follower_count/, body: accountBody(500) },
      {
        match: MEDIA,
        once: true,
        body: {
          data: [{ id: "history-1", timestamp: "2026-07-05T00:00:00Z" }],
          paging: { cursors: { after: "page-2" } },
        },
      },
      { match: MEDIA, body: { data: [{ id: "history-2", timestamp: "2026-07-06T00:00:00Z" }] } },
      { match: INSIGHTS, body: insightsBody(10) },
    ]);
    const { syncService } = await services();
    const sync = await enqueue({
      syncType: "BACKFILL",
      backfillFrom: new Date("2026-07-01T00:00:00Z"),
      backfillTo: new Date("2026-07-31T00:00:00Z"),
    });

    await syncService.process(sync.id, "worker-1");
    const afterFirst = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect((afterFirst.cursor as { discovery?: string }).discovery).toBe("page-2");
    expect(afterFirst.backfillCompleted).toBe(false);

    await prisma.socialAnalyticsSync.update({
      where: { id: sync.id },
      data: { status: "QUEUED", attemptCount: 0, completedAt: null },
    });
    await syncService.process(sync.id, "worker-1");
    const afterSecond = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect(afterSecond.backfillCompleted).toBe(true);

    const discovered = await prisma.socialPostMetric.findMany({
      where: { discoverySource: "PROVIDER_HISTORY" },
      distinct: ["providerPostId"],
    });
    expect(discovered.map((row) => row.providerPostId).sort()).toEqual(["history-1", "history-2"]);
    delete process.env.SOCIAL_ANALYTICS_BACKFILL_MAX_PAGES;
  });

  it("keeps platform attribution when provider history repeats a published post", async () => {
    stubProvider([
      { match: /insights\?metric=follower_count/, body: accountBody(500) },
      {
        match: MEDIA,
        body: { data: [{ id: tenant.providerPostId, timestamp: "2026-07-10T10:00:00Z" }] },
      },
      { match: INSIGHTS, body: insightsBody(64) },
    ]);
    const { syncService } = await services();
    const sync = await enqueue({ syncType: "INITIAL" });
    await syncService.process(sync.id, "worker-1");

    const rows = await prisma.socialPostMetric.findMany({
      where: { providerPostId: tenant.providerPostId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contentItemId: tenant.contentItem.id,
      discoverySource: "PLATFORM_PUBLISHING",
    });
  });

  it("refreshes an expired credential once, requeues, then completes", async () => {
    let expired = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("oauth/access_token")) {
          expired = false;
          return new Response(
            JSON.stringify({ access_token: "refreshed-token", expires_in: 5_184_000 }),
            { status: 200 },
          );
        }
        if (expired) return new Response(JSON.stringify({}), { status: 401 });
        if (MEDIA.test(url)) return new Response(JSON.stringify({ data: [] }), { status: 200 });
        if (url.includes("follower_count"))
          return new Response(JSON.stringify(accountBody(700)), { status: 200 });
        return new Response(JSON.stringify(insightsBody(33)), { status: 200 });
      }),
    );

    const { syncService } = await services();
    const sync = await enqueue();
    const first = await syncService.process(sync.id, "worker-1");
    expect(first).toMatchObject({ status: "REQUEUED_AFTER_REFRESH" });

    const requeued = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect(requeued.status).toBe("QUEUED");
    expect(requeued.refreshAttemptCount).toBe(1);
    const connection = await prisma.socialConnection.findUniqueOrThrow({
      where: { id: tenant.connection.id },
    });
    expect(connection.status).toBe("CONNECTED");
    expect(connection.lastRefreshAt).not.toBeNull();

    const second = await syncService.process(sync.id, "worker-1");
    expect(second).toMatchObject({ status: "COMPLETED" });
    expect(await prisma.socialPostMetric.count()).toBeGreaterThan(0);
  });

  it("marks the connection reconnect-required after a second expiry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("oauth/access_token")
          ? new Response(JSON.stringify({ error: { message: "invalid" } }), { status: 400 })
          : new Response(JSON.stringify({}), { status: 401 }),
      ),
    );
    const { syncService } = await services();
    const sync = await enqueue();
    expect(await syncService.process(sync.id, "worker-1")).toMatchObject({ status: "FAILED" });

    const failed = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect(failed.status).toBe("FAILED");
    const connection = await prisma.socialConnection.findUniqueOrThrow({
      where: { id: tenant.connection.id },
    });
    expect(connection.status).toBe("REAUTH_REQUIRED");
    expect(connection.reconnectRequiredAt).not.toBeNull();

    const errors = await prisma.socialAnalyticsError.findMany({ where: { terminal: true } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("keeps successful provider data when a later post fails", async () => {
    await prisma.publishingJob.update({
      where: { id: tenant.publishingJob.id },
      data: { providerUploadState: { postIds: [tenant.providerPostId, "broken-post"] } },
    });
    stubProvider([
      { match: /insights\?metric=follower_count/, body: accountBody(500) },
      { match: MEDIA, body: { data: [] } },
      { match: new RegExp(`${tenant.providerPostId}/insights`), body: insightsBody(77) },
      { match: /broken-post\/insights/, status: 500, body: { error: "boom" } },
    ]);
    const { syncService } = await services();
    const sync = await enqueue();
    const result = await syncService.process(sync.id, "worker-1");

    expect(result).toMatchObject({ status: "PARTIAL" });
    const stored = await prisma.socialPostMetric.findMany();
    expect(stored.map((row) => row.providerPostId)).toEqual([tenant.providerPostId]);
    const errors = await prisma.socialAnalyticsError.findMany();
    expect(errors[0]).toMatchObject({ providerPostId: "broken-post", syncPhase: "POST_METRICS" });
    const partial = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect(partial.nextRetryAt).not.toBeNull();
  });

  it("records unavailable provider metrics without writing zeros", async () => {
    stubProvider([
      { match: /insights\?metric=follower_count/, body: accountBody(400) },
      { match: MEDIA, body: { data: [] } },
      // The provider answers with no metric values at all.
      { match: INSIGHTS, body: { data: [] } },
    ]);
    const { syncService } = await services();
    const sync = await enqueue();
    await syncService.process(sync.id, "worker-1");

    expect(await prisma.socialPostMetric.count()).toBe(0);
    const snapshots = await prisma.socialMetricSnapshot.findMany({ where: { metricScope: "POST" } });
    expect(snapshots).toHaveLength(1);
  });

  it("deduplicates scheduled enqueues inside one window and coexists with manual syncs", async () => {
    const { schedulerService } = await services();
    const now = new Date("2026-07-29T13:00:00Z");
    const first = await schedulerService.enqueueDueAccounts(now);
    const second = await schedulerService.enqueueDueAccounts(new Date("2026-07-29T15:30:00Z"));

    expect(first.enqueued).toHaveLength(1);
    expect(second.enqueued).toHaveLength(0);
    expect(second.skipped[0]?.reason).toBe("ALREADY_SCHEDULED");
    expect(await prisma.socialAnalyticsSync.count()).toBe(1);

    await enqueue();
    expect(await prisma.socialAnalyticsSync.count()).toBe(2);

    const nextWindow = await schedulerService.enqueueDueAccounts(new Date("2026-07-29T19:00:00Z"));
    expect(nextWindow.enqueued).toHaveLength(1);
  });

  it("skips accounts whose brand, organisation, connection or capability is ineligible", async () => {
    const { schedulerService } = await services();
    await createTenant({ brandStatus: "ARCHIVED" });
    await createTenant({ organisationStatus: "SUSPENDED" });
    await createTenant({ withInsightsCapability: false });
    const reconnect = await createTenant();
    await prisma.socialConnection.update({
      where: { id: reconnect.connection.id },
      data: { reconnectRequiredAt: new Date() },
    });

    const outcome = await schedulerService.enqueueDueAccounts(new Date("2026-07-29T13:00:00Z"));
    expect(outcome.enqueued.map((item) => item.socialAccountId)).toEqual([tenant.account.id]);
  });

  it("isolates tenants at the database level", async () => {
    const other = await createTenant();
    stubHappyPath();
    const { syncService, queryService } = await services();
    await syncService.process((await enqueue()).id, "worker-1");

    const otherPosts = await queryService.posts(
      other.brand.id,
      other.organisation.id,
      rangeFilters,
      other.context as never,
    );
    expect(otherPosts).toEqual([]);

    await expect(
      queryService.posts(
        tenant.brand.id,
        other.organisation.id,
        rangeFilters,
        other.context as never,
      ),
    ).rejects.toThrow();

    // A sync row pointing at another tenant's account must be refused outright.
    const crossTenant = await prisma.socialAnalyticsSync.create({
      data: {
        organisationId: other.organisation.id,
        projectId: other.project.id,
        brandId: other.brand.id,
        socialAccountId: tenant.account.id,
        provider: tenant.account.provider,
        syncType: "INCREMENTAL",
        idempotencyKey: `cross-${other.id}`,
      },
    });
    await expect(syncService.process(crossTenant.id, "worker-1")).rejects.toThrow(
      "outside the tenant scope",
    );
  });

  it("aggregates content attribution from stored rows", async () => {
    stubHappyPath(200);
    const { syncService, queryService } = await services();
    await syncService.process((await enqueue()).id, "worker-1");

    for (const dimension of [
      "CONTENT_ITEM",
      "CAMPAIGN",
      "CONTENT_PILLAR",
      "CONTENT_TYPE",
      "OWNER",
      "PLATFORM",
    ] as const) {
      const result = await queryService.attribution(
        tenant.brand.id,
        tenant.organisation.id,
        rangeFilters,
        dimension,
        tenant.context as never,
      );
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0]?.totals.impressions).toBe(200);
      expect(result.groups[0]?.postsMeasured).toBe(1);
      // No interaction metric exists, so engagement stays null rather than becoming zero.
      expect(result.groups[0]?.derived.engagementRate).toBeNull();
    }

    const exported = await queryService.export(
      tenant.brand.id,
      tenant.organisation.id,
      rangeFilters,
      "ATTRIBUTION",
      "CSV",
      tenant.context as never,
      "CAMPAIGN",
    );
    expect(exported.body).toContain("Summer launch");
    expect(exported.body.split("\n")[0]).toContain("scope=ATTRIBUTION");
  });

  it("buckets stored observations by the brand timezone", async () => {
    stubHappyPath();
    const { syncService, queryService } = await services();
    await syncService.process((await enqueue()).id, "worker-1");
    // Force the observation into the last hour of a UTC day, which is the next day in Sydney.
    await prisma.socialPostMetric.updateMany({
      data: { measuredAt: new Date("2026-07-15T23:30:00Z") },
    });
    await prisma.brand.update({
      where: { id: tenant.brand.id },
      data: { analyticsTimezone: "Australia/Sydney" },
    });

    const overview = await queryService.overview(
      tenant.brand.id,
      tenant.organisation.id,
      rangeFilters,
      tenant.context as never,
    );
    expect(overview.timezone).toBe("Australia/Sydney");
    expect(overview.series[0]?.period).toBe("2026-07-16");

    await prisma.brand.update({
      where: { id: tenant.brand.id },
      data: { analyticsTimezone: "UTC" },
    });
    const utc = await queryService.overview(
      tenant.brand.id,
      tenant.organisation.id,
      rangeFilters,
      tenant.context as never,
    );
    expect(utc.series[0]?.period).toBe("2026-07-15");
  });

  it("drains due work through the real worker route", async () => {
    stubHappyPath();
    process.env.PUBLISHING_WORKER_TOKEN = "database-suite-worker-token";
    const sync = await enqueue();
    const { POST } = await import("@/app/api/social-analytics-sync/process-due/route");
    const response = await POST(
      new NextRequest("https://app.test/api/social-analytics-sync/process-due", {
        method: "POST",
        headers: { authorization: "Bearer database-suite-worker-token" },
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.results.map((item: { syncId: string }) => item.syncId)).toContain(sync.id);
    expect(await prisma.socialPostMetric.count()).toBeGreaterThan(0);
  });

  it("refuses the worker route without a valid token and leaves work untouched", async () => {
    stubHappyPath();
    process.env.PUBLISHING_WORKER_TOKEN = "database-suite-worker-token";
    const sync = await enqueue();
    const { POST } = await import("@/app/api/social-analytics-sync/process-due/route");
    const response = await POST(
      new NextRequest("https://app.test/api/social-analytics-sync/process-due", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(response.status).toBe(403);
    const untouched = await prisma.socialAnalyticsSync.findUniqueOrThrow({ where: { id: sync.id } });
    expect(untouched.status).toBe("QUEUED");
    expect(await prisma.socialPostMetric.count()).toBe(0);
  });
});
