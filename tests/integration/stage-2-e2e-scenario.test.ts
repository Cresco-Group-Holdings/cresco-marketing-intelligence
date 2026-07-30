import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  contentSchedule: { findMany: vi.fn(), update: vi.fn() },
  publishingJob: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
}));
const worker = vi.hoisted(() => ({ processPublishingJob: vi.fn() }));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/publishing-worker", () => worker);

import { accountHasPublishingCapability } from "@/lib/publishing/capabilities";
import { isProviderPublishingDisabled } from "@/lib/publishing/config";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";

/**
 * Focused Stage 2 scenario (mocked): an approved post is scheduled, the scheduler enqueues a
 * durable PublishingJob when due, and the worker dispatches it to the provider adapter.
 */
describe("Stage 2 publishing scenario (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PUBLISHING_DISABLE_INSTAGRAM;
    delete process.env.PUBLISHING_EMERGENCY_SHUTDOWN;
  });

  it("moves a due READY schedule through enqueue and worker dispatch", async () => {
    const dueAt = new Date("2026-07-29T14:00:00Z");
    const now = new Date("2026-07-29T14:01:00Z");

    prisma.contentSchedule.findMany.mockResolvedValue([
      {
        id: "schedule-stage2",
        organisationId: "org-stage2",
        projectId: "project-stage2",
        brandId: "brand-stage2",
        contentItemId: "content-stage2",
        contentVariantId: "variant-stage2",
        socialAccountId: "account-stage2",
        scheduledFor: dueAt,
        timezone: "UTC",
        status: "READY",
        createdByUserId: "user-stage2",
        contentVariant: { provider: "INSTAGRAM", format: "IMAGE_POST" },
        socialAccount: {
          id: "account-stage2",
          capabilities: [{ capability: "PUBLISH_IMAGE" }],
        },
      },
    ]);
    prisma.publishingJob.findFirst.mockResolvedValue(null);
    prisma.publishingJob.create.mockResolvedValue({ id: "job-stage2" });
    prisma.contentSchedule.update.mockResolvedValue({});
    prisma.publishingJob.findMany.mockResolvedValue([{ id: "job-stage2" }]);
    worker.processPublishingJob.mockResolvedValue({
      state: "PUBLISHED",
      postId: "ig-post-1",
      permalink: "https://instagram.com/p/abc",
      containerId: "container-1",
    });

    expect(isProviderPublishingDisabled("INSTAGRAM")).toBe(false);
    expect(accountHasPublishingCapability("IMAGE_POST", ["PUBLISH_IMAGE"])).toBe(true);

    const result = await publishingSchedulerService.runSchedulerPass({ now, limit: 1 });

    expect(result.scheduled.enqueued).toEqual([
      { contentScheduleId: "schedule-stage2", publishingJobId: "job-stage2" },
    ]);
    expect(worker.processPublishingJob).toHaveBeenCalledWith("job-stage2");
    expect(result.processed[0]).toMatchObject({
      jobId: "job-stage2",
      result: { state: "PUBLISHED", postId: "ig-post-1" },
    });
  });

  it("blocks the scenario when an operator disables the provider", async () => {
    process.env.PUBLISHING_DISABLE_INSTAGRAM = "true";
    prisma.contentSchedule.findMany.mockResolvedValue([
      {
        id: "schedule-blocked",
        organisationId: "org-stage2",
        projectId: "project-stage2",
        brandId: "brand-stage2",
        contentItemId: "content-stage2",
        contentVariantId: "variant-stage2",
        socialAccountId: "account-stage2",
        scheduledFor: new Date("2026-07-29T14:00:00Z"),
        timezone: "UTC",
        status: "READY",
        createdByUserId: "user-stage2",
        contentVariant: { provider: "INSTAGRAM", format: "IMAGE_POST" },
        socialAccount: {
          id: "account-stage2",
          capabilities: [{ capability: "PUBLISH_IMAGE" }],
        },
      },
    ]);

    const result = await publishingSchedulerService.enqueueDueSchedules(
      new Date("2026-07-29T14:01:00Z"),
    );

    expect(isProviderPublishingDisabled("INSTAGRAM")).toBe(true);
    expect(result.enqueued).toEqual([]);
    expect(result.skipped[0]?.reason).toBe("PROVIDER_DISABLED");
    expect(prisma.publishingJob.create).not.toHaveBeenCalled();
  });
});
