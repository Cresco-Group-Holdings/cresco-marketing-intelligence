import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  contentSchedule: { findMany: vi.fn(), update: vi.fn() },
  publishingJob: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
}));
const worker = vi.hoisted(() => ({ processPublishingJob: vi.fn() }));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/publishing-worker", () => worker);
vi.mock("@/server/services/canonical-publication-service", () => ({
  canonicalPublicationService: {
    enqueueDueScheduledPublications: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/server/services/publication-analytics-sync-service", () => ({
  publicationAnalyticsSyncService: {
    processDueSyncs: vi.fn().mockResolvedValue([]),
  },
}));

import { scheduledJobIdempotencyKey } from "@/lib/publishing/config";
import { resetPublishingCounters, readPublishingCounters } from "@/lib/publishing/observability";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";

const schedule = (overrides: Record<string, unknown> = {}) => ({
  id: "schedule-1",
  organisationId: "org-1",
  projectId: "project-1",
  brandId: "brand-1",
  contentItemId: "content-1",
  contentVariantId: "variant-1",
  socialAccountId: "account-1",
  scheduledFor: new Date("2026-07-29T12:00:00Z"),
  timezone: "UTC",
  status: "READY",
  createdByUserId: "user-1",
  contentVariant: { provider: "INSTAGRAM", format: "IMAGE_POST" },
  socialAccount: {
    id: "account-1",
    capabilities: [{ capability: "PUBLISH_IMAGE" }],
  },
  ...overrides,
});

const now = new Date("2026-07-29T13:00:00Z");

describe("publishingSchedulerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPublishingCounters();
    delete process.env.PUBLISHING_SCHEDULER_ENABLED;
    delete process.env.PUBLISHING_EMERGENCY_SHUTDOWN;
    delete process.env.PUBLISHING_DISABLE_INSTAGRAM;
    prisma.contentSchedule.findMany.mockResolvedValue([schedule()]);
    prisma.publishingJob.findFirst.mockResolvedValue(null);
    prisma.publishingJob.create.mockResolvedValue({ id: "job-1" });
    prisma.contentSchedule.update.mockResolvedValue({});
    worker.processPublishingJob.mockResolvedValue({ state: "PUBLISHED" });
  });

  it("only considers READY schedules in active tenants with connected accounts", async () => {
    await publishingSchedulerService.enqueueDueSchedules(now);
    const where = prisma.contentSchedule.findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("READY");
    expect(where.scheduledFor).toEqual({ lte: now });
    expect(where.socialAccount).toEqual({
      status: "CONNECTED",
      socialConnection: { status: "CONNECTED", reconnectRequiredAt: null },
    });
    expect(where.contentItem.brand).toEqual({
      status: "ACTIVE",
      archivedAt: null,
      organisation: { status: "ACTIVE", archivedAt: null },
    });
  });

  it("enqueues a durable publishing job for a due schedule", async () => {
    const outcome = await publishingSchedulerService.enqueueDueSchedules(now);
    expect(outcome.enqueued).toEqual([
      { contentScheduleId: "schedule-1", publishingJobId: "job-1" },
    ]);
    expect(prisma.publishingJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentScheduleId: "schedule-1",
        idempotencyKey: scheduledJobIdempotencyKey("schedule-1"),
        status: "QUEUED",
      }),
    });
    expect(prisma.contentSchedule.update).toHaveBeenCalledWith({
      where: { id: "schedule-1" },
      data: { status: "QUEUED" },
    });
    expect(readPublishingCounters()["publishing.scheduled_jobs_enqueued"]).toBe(1);
  });

  it("skips schedules when the provider is emergency-disabled", async () => {
    process.env.PUBLISHING_DISABLE_INSTAGRAM = "true";
    const outcome = await publishingSchedulerService.enqueueDueSchedules(now);
    expect(outcome.enqueued).toEqual([]);
    expect(outcome.skipped).toEqual([
      { contentScheduleId: "schedule-1", reason: "PROVIDER_DISABLED" },
    ]);
    expect(prisma.publishingJob.create).not.toHaveBeenCalled();
    expect(readPublishingCounters()["publishing.provider_shutdown_skipped"]).toBe(1);
  });

  it("skips schedules when the account lacks the required capability", async () => {
    prisma.contentSchedule.findMany.mockResolvedValue([
      schedule({
        contentVariant: { provider: "INSTAGRAM", format: "CAROUSEL" },
        socialAccount: { id: "account-1", capabilities: [{ capability: "PUBLISH_IMAGE" }] },
      }),
    ]);
    const outcome = await publishingSchedulerService.enqueueDueSchedules(now);
    expect(outcome.skipped).toEqual([
      { contentScheduleId: "schedule-1", reason: "CAPABILITY_BLOCKED" },
    ]);
    expect(readPublishingCounters()["publishing.capability_blocked"]).toBe(1);
  });

  it("collapses repeated runs onto an existing publishing job", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue({ id: "job-existing" });
    const outcome = await publishingSchedulerService.enqueueDueSchedules(now);
    expect(outcome.enqueued).toEqual([]);
    expect(outcome.skipped).toEqual([
      { contentScheduleId: "schedule-1", reason: "ALREADY_ENQUEUED" },
    ]);
    expect(prisma.publishingJob.create).not.toHaveBeenCalled();
  });

  it("stops enqueuing when the scheduler is disabled", async () => {
    process.env.PUBLISHING_SCHEDULER_ENABLED = "false";
    const outcome = await publishingSchedulerService.enqueueDueSchedules(now);
    expect(outcome.enqueued).toEqual([]);
    expect(prisma.contentSchedule.findMany).not.toHaveBeenCalled();
  });

  it("drains due publishing jobs after enqueuing schedules", async () => {
    prisma.publishingJob.findMany.mockResolvedValue([{ id: "job-1" }]);
    const result = await publishingSchedulerService.runSchedulerPass({
      now,
      limit: 3,
      workerId: "worker-x",
    });
    expect(worker.processPublishingJob).toHaveBeenCalledWith("job-1");
    expect(result.processed).toHaveLength(1);
    expect(result.scheduled.enqueued).toHaveLength(1);
    expect(result.metricsSynced).toEqual([]);
    expect(readPublishingCounters()["publishing.jobs_processed"]).toBe(1);
  });
});
