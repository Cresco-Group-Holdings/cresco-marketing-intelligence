import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetPublishingCounters } from "@/lib/publishing/observability";
import { setClockForTests } from "@/lib/workers/clock";
import { discoverPublishingDueWork } from "@/server/services/worker-due-providers/publishing-due-provider";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  publishingJob: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  publication: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  contentAsset: { findMany: vi.fn() },
  publicationAttempt: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  providerConnection: { update: vi.fn() },
  automationWorkflow: { findMany: vi.fn(), findFirst: vi.fn() },
  automationExecution: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  automationQuotaUsage: { upsert: vi.fn(), update: vi.fn() },
  contentCampaign: { findFirst: vi.fn() },
  providerSyncRun: { findFirst: vi.fn() },
  workerJob: { findFirst: vi.fn(), count: vi.fn() },
  organisation: { findMany: vi.fn() },
}));

const tokenLifecycleMock = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
}));

const providerGatewayMock = vi.hoisted(() => ({
  execute: vi.fn(),
}));

const buildTenantContextForUserMock = vi.hoisted(() => vi.fn());
const providerSyncEngineMock = vi.hoisted(() => ({
  executeSyncRun: vi.fn(),
}));
const buildWorkerTenantContextMock = vi.hoisted(() => vi.fn());
const notificationEmitMock = vi.hoisted(() => vi.fn());
const crmTaskCreateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/token-lifecycle-service", () => ({
  tokenLifecycleService: tokenLifecycleMock,
}));
vi.mock("@/server/services/provider-gateway-service", () => ({
  providerGateway: providerGatewayMock,
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return {
    ...actual,
    buildTenantContextForUser: buildTenantContextForUserMock,
  };
});
vi.mock("@/server/services/calendar-projection-service", () => ({
  calendarProjectionService: { syncPublication: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/services/notification-event-service", () => ({
  notificationEventService: {
    publicationSucceeded: vi.fn().mockResolvedValue(undefined),
    publicationFailed: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => ({
    createSignedUrl: vi.fn().mockResolvedValue({ url: "https://signed.test/media.jpg" }),
  }),
}));
vi.mock("@/server/services/provider-sync-engine-service", () => ({
  providerSyncEngineService: providerSyncEngineMock,
}));
vi.mock("@/lib/workers/tenant-context", () => ({
  buildWorkerTenantContext: buildWorkerTenantContextMock,
}));
vi.mock("@/server/services/notification-service", () => ({
  notificationService: { emit: notificationEmitMock },
}));
vi.mock("@/server/services/crm-task-service", () => ({
  crmTaskService: { createTask: crmTaskCreateMock },
}));
vi.mock("@/server/services/operational-alert-service", () => ({
  operationalAlertService: { upsert: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/server/services/operational-alert-service", () => ({
  operationalAlertService: { upsert: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/services/scheduler-health-service", () => ({
  schedulerHealthService: {
    recordDispatch: vi.fn().mockResolvedValue(undefined),
    recordProcess: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/server/services/worker-dispatcher-service", () => ({
  workerDispatcherService: {
    dispatchDueJobs: vi.fn().mockResolvedValue({
      discovered: 0,
      created: 0,
      activated: 0,
      skipped: 0,
    }),
  },
}));
vi.mock("@/server/services/worker-executor-service", () => ({
  workerExecutorService: {
    processAvailableJobs: vi.fn().mockResolvedValue({
      claimed: 0,
      succeeded: 0,
      failed: 0,
      retrying: 0,
      skipped: 0,
      deadLettered: 0,
      durationMs: 1,
    }),
  },
}));
vi.mock("@/server/services/worker-job-service", () => ({
  workerJobService: { recoverExpiredJobs: vi.fn().mockResolvedValue(0) },
}));

import { processPublicationPublishingJob } from "@/server/services/publication-publishing-worker";
import { providerSyncWorkerHandler } from "@/server/services/worker-handlers/provider-sync-handler";
import { automationScheduleService } from "@/server/services/automation-schedule-service";
import { GET as recoverGet } from "@/app/api/workers/recover/route";
import { GET as dispatchGet } from "@/app/api/workers/dispatch/route";
import { GET as processGet } from "@/app/api/workers/process/route";
import { GET as automationSchedulesGet } from "@/app/api/workers/automation-schedules/route";

const tenant = {
  userId: "auth-user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
  organisationRole: "ADMIN" as const,
  projectId: "proj-1",
  brandId: "brand-1",
};

function publicationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "pub-1",
    organisationId: "org-1",
    projectId: "proj-1",
    brandId: "brand-1",
    connectionId: "conn-1",
    providerKey: "mock-social",
    operationType: "SOCIAL_PUBLISH_POST",
    status: "QUEUED",
    externalAccountId: "acct-1",
    destinationId: "acct-1",
    scheduledFor: null,
    timezone: "UTC",
    idempotencyKey: "idem-1",
    dryRun: false,
    providerPayload: { mediaUrls: ["https://signed.test/media.jpg"] },
    requestedByUserId: "profile-1",
    contentItemId: "content-1",
    contentVariantId: null,
    contentItem: {
      primaryMessage: "Hello",
      variants: [{ id: "var-1", caption: "Hello" }],
    },
    ...overrides,
  };
}

function jobFixture(publication = publicationFixture(), attemptCount = 0) {
  return {
    id: "job-1",
    publicationId: "pub-1",
    status: "QUEUED",
    attemptCount,
    publication,
  };
}

function readyContentAssets() {
  return [
    {
      marketingAsset: {
        id: "asset-1",
        status: "READY",
        approvedForMarketing: true,
        assetType: "IMAGE",
        licenceExpiresAt: null,
        mimeType: "image/jpeg",
      },
    },
  ];
}

function transactionMock(publication = publicationFixture(), attemptCount = 0) {
  return {
    $executeRaw: vi.fn(),
    publishingJob: {
      findUnique: vi.fn().mockResolvedValue(jobFixture(publication, attemptCount)),
      update: vi.fn().mockResolvedValue({}),
    },
    publication: { update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
    publicationAttempt: prismaMock.publicationAttempt,
    contentAsset: {
      findMany: vi.fn().mockResolvedValue(readyContentAssets()),
    },
    providerConnection: { update: vi.fn().mockResolvedValue({}) },
  };
}

function workerRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://app.test${path}`, { method: "GET", headers });
}

describe("Task 6.2 verification journeys", () => {
  const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    resetPublishingCounters();
    setClockForTests({ now: () => FIXED_NOW, random: () => 0 });
    buildTenantContextForUserMock.mockResolvedValue(tenant);
    tokenLifecycleMock.getValidAccessToken.mockResolvedValue({
      accessToken: "token-1",
      status: "VALID",
    });
    providerGatewayMock.execute.mockResolvedValue({
      success: true,
      data: {
        externalPublicationId: "ext-post-1",
        permalink: "https://mock.test/posts/ext-post-1",
        duplicate: false,
      },
    });
    prismaMock.publicationAttempt.count.mockResolvedValue(0);
    prismaMock.publicationAttempt.create.mockResolvedValue({ id: "attempt-1", requestId: "req-1" });
    prismaMock.publicationAttempt.update.mockResolvedValue({});
    prismaMock.publishingJob.update.mockResolvedValue({});
    prismaMock.contentAsset.findMany.mockResolvedValue([]);
    process.env.WORKER_TOKEN = "task6-worker-token";
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    setClockForTests(null);
    delete process.env.WORKER_TOKEN;
  });

  describe("Journey A — scheduled publication", () => {
    it("does not discover publications before scheduled due time", async () => {
      const futureDue = new Date(FIXED_NOW.getTime() + 10 * 60_000);
      prismaMock.publication.findMany.mockResolvedValue([]);

      const due = await discoverPublishingDueWork(FIXED_NOW, 10);
      expect(due).toHaveLength(0);
      expect(prismaMock.publication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "SCHEDULED",
            scheduledFor: { lte: FIXED_NOW },
          }),
        }),
      );
      expect(futureDue > FIXED_NOW).toBe(true);
    });

    it("publishes via mocked provider without browser session", async () => {
      const publication = publicationFixture({ status: "QUEUED" });
      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(transactionMock(publication)),
      );

      const result = await processPublicationPublishingJob("job-1", tenant);

      expect(result?.state).toBe("PUBLISHED");
      expect(providerGatewayMock.execute).toHaveBeenCalledTimes(1);
      expect(buildTenantContextForUserMock).not.toHaveBeenCalled();
    });
  });

  describe("Journey B — temporary failure and recovery", () => {
    it("classifies 429 as retryable and succeeds on recovery without duplicate posts", async () => {
      const publication = publicationFixture({ status: "QUEUED" });
      providerGatewayMock.execute
        .mockResolvedValueOnce({
          success: false,
          errorCode: "RATE_LIMITED",
          errorMessageSafe: "Provider rate limited.",
          retryable: true,
        })
        .mockResolvedValueOnce({
          success: true,
          data: { externalPublicationId: "ext-post-1", duplicate: false },
        });

      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(transactionMock(publication, 1)),
      );

      const failed = await processPublicationPublishingJob("job-1", tenant);
      expect(failed?.state).toBe("FAILED");
      if (failed?.state === "FAILED") {
        expect(failed.category).toBe("RETRYABLE");
      }

      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(transactionMock({ ...publication, status: "QUEUED" }, 2)),
      );
      const recovered = await processPublicationPublishingJob("job-1", tenant);
      expect(recovered?.state).toBe("PUBLISHED");
      expect(providerGatewayMock.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("ambiguous provider timeout", () => {
    it("treats duplicate provider acknowledgement as idempotent success", async () => {
      providerGatewayMock.execute.mockResolvedValue({
        success: true,
        data: { externalPublicationId: "ext-dup", duplicate: true },
      });

      const publication = publicationFixture();
      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(transactionMock(publication)),
      );

      const result = await processPublicationPublishingJob("job-1", tenant);
      expect(result).toEqual({ state: "DUPLICATE", externalPublicationId: "ext-dup" });
      expect(providerGatewayMock.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("Journey C — reauthentication", () => {
    it("stops retry loop when token refresh fails", async () => {
      tokenLifecycleMock.getValidAccessToken.mockResolvedValue({
        accessToken: null,
        status: "REAUTH_REQUIRED",
      });

      const publication = publicationFixture({ status: "QUEUED" });
      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(transactionMock(publication)),
      );

      const result = await processPublicationPublishingJob("job-1", tenant);
      expect(result?.state).toBe("REAUTH_REQUIRED");
      expect(providerGatewayMock.execute).not.toHaveBeenCalled();
    });
  });

  describe("provider sync journey", () => {
    it("executes PROVIDER_SYNC worker with mocked observations", async () => {
      prismaMock.providerSyncRun.findFirst.mockResolvedValue({
        id: "sync-1",
        requestedByUserId: "profile-1",
      });
      buildWorkerTenantContextMock.mockResolvedValue(tenant);
      providerSyncEngineMock.executeSyncRun.mockResolvedValue({
        status: "SUCCEEDED",
        recordsProcessed: 3,
      });

      const result = await providerSyncWorkerHandler(
        {
          jobId: "job-sync",
          organisationId: "org-1",
          domainRefType: "providerSyncRun",
          domainRefId: "sync-1",
          payload: null,
          attemptCount: 0,
        },
        { workerId: "worker-1", now: FIXED_NOW, heartbeat: vi.fn() },
      );

      expect(result.outcome).toBe("success");
      expect(providerSyncEngineMock.executeSyncRun).toHaveBeenCalledWith(
        "sync-1",
        "org-1",
        tenant,
      );
    });
  });

  describe("Journey D — automation schedule execution", () => {
    it("creates execution when campaign review schedule is due", async () => {
      const fridayMorning = new Date("2026-07-17T08:00:00.000Z");
      setClockForTests({ now: () => fridayMorning, random: () => 0 });

      prismaMock.automationWorkflow.findMany.mockResolvedValue([
        {
          id: "wf-campaign",
          organisationId: "org-1",
          projectId: "proj-1",
          brandId: "brand-1",
          createdByUserId: "profile-1",
          executionLimitPerDay: 10,
          monthlyQuota: 100,
          activeVersion: {
            id: "ver-1",
            triggers: [
              {
                scheduleCron: "0 9 * * 5",
                config: { timezone: "Europe/London" },
              },
            ],
            conditions: [{ field: "campaign.status", operator: "equals", value: "ACTIVE" }],
            actions: [],
          },
        },
      ]);
      prismaMock.automationExecution.findUnique.mockResolvedValue(null);
      prismaMock.publication.count.mockResolvedValue(2);
      prismaMock.contentCampaign.findFirst.mockResolvedValue({ status: "ACTIVE" });
      prismaMock.automationExecution.count.mockResolvedValue(0);
      prismaMock.automationQuotaUsage.upsert.mockResolvedValue({
        id: "quota-1",
        executionCount: 0,
      });
      prismaMock.automationExecution.create.mockResolvedValue({ id: "exec-1" });

      const summary = await automationScheduleService.dispatchDueSchedules(fridayMorning);
      expect(summary.triggered).toBe(1);
      expect(summary.executionIds).toContain("exec-1");
    });
  });

  describe("Journey E — no content scheduled alert", () => {
    it("fires once and deduplicates on repeated evaluation", async () => {
      const mondayMorning = new Date("2026-07-13T08:00:00.000Z");
      setClockForTests({ now: () => mondayMorning, random: () => 0 });

      const workflow = {
        id: "wf-no-content",
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        createdByUserId: "profile-1",
        executionLimitPerDay: 10,
        monthlyQuota: 100,
        activeVersion: {
          id: "ver-1",
          triggers: [{ scheduleCron: "0 9 * * 1", config: { timezone: "Europe/London" } }],
          conditions: [{ field: "content.upcomingCount", operator: "equals", value: 0 }],
          actions: [],
        },
      };

      prismaMock.automationWorkflow.findMany.mockResolvedValue([workflow]);
      prismaMock.publication.count.mockResolvedValue(0);
      prismaMock.contentCampaign.findFirst.mockResolvedValue(null);
      prismaMock.automationExecution.count.mockResolvedValue(0);
      prismaMock.automationQuotaUsage.upsert.mockResolvedValue({
        id: "quota-1",
        executionCount: 0,
      });
      prismaMock.automationExecution.create.mockResolvedValue({ id: "exec-no-content" });

      prismaMock.automationExecution.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "exec-no-content", status: "PENDING" });

      const first = await automationScheduleService.dispatchDueSchedules(mondayMorning);
      const second = await automationScheduleService.dispatchDueSchedules(mondayMorning);

      expect(first.triggered).toBe(1);
      expect(second.skipped).toBeGreaterThanOrEqual(1);
      expect(prismaMock.automationExecution.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduler auth regression", () => {
    it("rejects worker routes without WORKER_TOKEN", async () => {
      delete process.env.WORKER_TOKEN;
      delete process.env.PUBLISHING_WORKER_TOKEN;

      const routes = [
        recoverGet(workerRequest("/api/workers/recover")),
        dispatchGet(workerRequest("/api/workers/dispatch")),
        processGet(workerRequest("/api/workers/process")),
        automationSchedulesGet(workerRequest("/api/workers/automation-schedules")),
      ];

      for (const response of await Promise.all(routes)) {
        expect(response.status).toBe(403);
      }
    });
  });
});
