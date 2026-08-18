import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  hasPublishingSchedule,
  nullToUndefined,
  requirePublishingSchedule,
  resolveContentScheduleId,
} from "@/lib/publishing/schedule";
import {
  PUBLISHING_COUNTERS,
  incrementPublishingCounter,
  readPublishingCounters,
  resetPublishingCounters,
} from "@/lib/publishing/observability";
import { buildWorkerTenantContext } from "@/lib/workers/tenant-context";
import type { PublicationJobOutcome } from "@/server/services/publication-publishing-worker";

const prismaMock = vi.hoisted(() => ({
  providerSyncRun: { findMany: vi.fn() },
  organisation: { findUnique: vi.fn() },
  providerConnection: { findFirst: vi.fn() },
  digitalAssetProcessingJob: { findFirst: vi.fn() },
}));

const processDueJobsMock = vi.hoisted(() => vi.fn());
const refreshConnectionTokensMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/digital-asset-processing-service", () => ({
  digitalAssetProcessingService: { processDueJobs: processDueJobsMock },
}));
vi.mock("@/server/services/token-lifecycle-service", () => ({
  tokenLifecycleService: { refreshConnectionTokens: refreshConnectionTokensMock },
}));

import { discoverProviderSyncDueWork } from "@/server/services/worker-due-providers/provider-sync-due-provider";
import { damProcessingWorkerHandler } from "@/server/services/worker-handlers/dam-processing-handler";
import { tokenRefreshWorkerHandler } from "@/server/services/worker-handlers/token-refresh-handler";

describe("publishing schedule contract", () => {
  it("narrows jobs with a schedule", () => {
    const job = { id: "job-1", schedule: { id: "schedule-1" }, contentScheduleId: "schedule-1" };
    expect(hasPublishingSchedule(job)).toBe(true);
    if (hasPublishingSchedule(job)) {
      expect(job.schedule.id).toBe("schedule-1");
    }
  });

  it("rejects jobs without a schedule", () => {
    const job = { id: "job-2", schedule: null, contentScheduleId: null };
    expect(hasPublishingSchedule(job)).toBe(false);
    expect(() => requirePublishingSchedule(job)).toThrow(AppError);
  });

  it("resolves schedule ids from relation or foreign key", () => {
    expect(
      resolveContentScheduleId({ contentScheduleId: "schedule-1", schedule: { id: "schedule-1" } }),
    ).toBe("schedule-1");
    expect(resolveContentScheduleId({ contentScheduleId: null, schedule: { id: "schedule-2" } })).toBe(
      "schedule-2",
    );
    expect(resolveContentScheduleId({ contentScheduleId: null, schedule: null })).toBeUndefined();
  });
});

describe("null to undefined normalization", () => {
  it("converts null to undefined", () => {
    expect(nullToUndefined(null)).toBeUndefined();
  });

  it("preserves empty strings and actual strings", () => {
    expect(nullToUndefined("")).toBe("");
    expect(nullToUndefined("caption")).toBe("caption");
  });
});

describe("publishing telemetry taxonomy", () => {
  beforeEach(() => resetPublishingCounters());

  it("tracks canonical lifecycle counters", () => {
    incrementPublishingCounter("publishing.jobs_processed");
    incrementPublishingCounter("publishing.jobs_failed");
    incrementPublishingCounter("publishing.completed_jobs");
    incrementPublishingCounter("publishing.duplicate_prevented");

    expect(readPublishingCounters()).toEqual({
      "publishing.jobs_processed": 1,
      "publishing.jobs_failed": 1,
      "publishing.completed_jobs": 1,
      "publishing.duplicate_prevented": 1,
    });
    expect(PUBLISHING_COUNTERS).not.toContain("publishing.job_started");
    expect(PUBLISHING_COUNTERS).not.toContain("publishing.job_failed");
  });
});

describe("worker tenant context", () => {
  it("builds a canonical tenant context for background workers", async () => {
    prismaMock.organisation.findUnique.mockResolvedValue({ createdByUserId: "user-profile-1" });

    const context = await buildWorkerTenantContext("org-1");

    expect(context).toEqual({
      userId: "user-profile-1",
      userProfileId: "user-profile-1",
      organisationId: "org-1",
      organisationRole: "ADMIN",
    });
  });
});

describe("provider sync due provider", () => {
  it("filters by active organisation through the connection relation", async () => {
    prismaMock.providerSyncRun.findMany.mockResolvedValue([]);

    await discoverProviderSyncDueWork(new Date("2026-08-17T12:00:00Z"), 10);

    expect(prismaMock.providerSyncRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          connection: {
            organisation: { status: "ACTIVE", archivedAt: null },
          },
        }),
      }),
    );
  });
});

const workerContext = {
  workerId: "worker-1",
  now: new Date("2026-08-17T12:00:00Z"),
  heartbeat: vi.fn().mockResolvedValue(undefined),
};

describe("DAM processing handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up outcomes from the canonical processDueJobs result", async () => {
    prismaMock.digitalAssetProcessingJob.findFirst.mockResolvedValue({
      id: "dam-job-1",
      status: "QUEUED",
    });
    processDueJobsMock.mockResolvedValue({
      processed: 1,
      outcomes: [{ jobId: "dam-job-1", status: "COMPLETED" }],
    });

    const result = await damProcessingWorkerHandler(
      {
        jobId: "worker-job-1",
        organisationId: "org-1",
        domainRefType: "digitalAssetProcessingJob",
        domainRefId: "dam-job-1",
        payload: {},
        attemptCount: 1,
      },
      workerContext,
    );

    expect(result.outcome).toBe("success");
  });

  it("skips when the job outcome is missing", async () => {
    prismaMock.digitalAssetProcessingJob.findFirst.mockResolvedValue({
      id: "dam-job-2",
      status: "QUEUED",
    });
    processDueJobsMock.mockResolvedValue({ processed: 0, outcomes: [] });

    const result = await damProcessingWorkerHandler(
      {
        jobId: "worker-job-2",
        organisationId: "org-1",
        domainRefType: "digitalAssetProcessingJob",
        domainRefId: "dam-job-2",
        payload: {},
        attemptCount: 1,
      },
      workerContext,
    );

    expect(result).toEqual({ outcome: "skipped", reason: "DAM job not due." });
  });
});

describe("token refresh handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("treats ACTIVE and EXPIRING as usable token states", async () => {
    prismaMock.providerConnection.findFirst.mockResolvedValue({ id: "conn-1" });
    refreshConnectionTokensMock.mockResolvedValue({ status: "ACTIVE" });

    const active = await tokenRefreshWorkerHandler(
      {
        jobId: "worker-job-3",
        organisationId: "org-1",
        domainRefType: "providerConnection",
        domainRefId: "conn-1",
        payload: {},
        attemptCount: 1,
      },
      workerContext,
    );
    expect(active).toEqual({ outcome: "success" });

    refreshConnectionTokensMock.mockResolvedValue({ status: "EXPIRING" });
    const expiring = await tokenRefreshWorkerHandler(
      {
        jobId: "worker-job-4",
        organisationId: "org-1",
        domainRefType: "providerConnection",
        domainRefId: "conn-1",
        payload: {},
        attemptCount: 1,
      },
      workerContext,
    );
    expect(expiring).toEqual({ outcome: "success" });
  });

  it("retries when refresh fails without reauth", async () => {
    prismaMock.providerConnection.findFirst.mockResolvedValue({ id: "conn-1" });
    refreshConnectionTokensMock.mockResolvedValue({ status: "REFRESH_FAILED" });

    const result = await tokenRefreshWorkerHandler(
      {
        jobId: "worker-job-5",
        organisationId: "org-1",
        domainRefType: "providerConnection",
        domainRefId: "conn-1",
        payload: {},
        attemptCount: 1,
      },
      workerContext,
    );

    expect(result.outcome).toBe("retry");
  });
});

describe("publication job outcome narrowing", () => {
  it("exposes externalPublicationId only on published outcomes", () => {
    const published: PublicationJobOutcome = {
      state: "PUBLISHED",
      externalPublicationId: "ext-1",
      permalink: "https://example.com/post",
    };
    const failed: PublicationJobOutcome = { state: "FAILED", reason: "nope", category: "PROVIDER" };

    if (published.state === "PUBLISHED") {
      expect(published.externalPublicationId).toBe("ext-1");
    }
    if (failed.state === "FAILED") {
      expect("externalPublicationId" in failed).toBe(false);
    }
  });
});
