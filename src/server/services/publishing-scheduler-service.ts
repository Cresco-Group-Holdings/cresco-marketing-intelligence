import type { SocialCapability } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";
import { accountHasPublishingCapability } from "@/lib/publishing/capabilities";
import {
  getPublishingConfig,
  isProviderPublishingDisabled,
  scheduledJobIdempotencyKey,
} from "@/lib/publishing/config";
import { incrementPublishingCounter } from "@/lib/publishing/observability";
import { processPublishingJob } from "@/server/services/publishing-worker";

export type PublishingSchedulerSkipReason =
  | "SCHEDULER_DISABLED"
  | "PROVIDER_DISABLED"
  | "CAPABILITY_BLOCKED"
  | "ALREADY_ENQUEUED";

export type PublishingSchedulerOutcome = {
  enqueued: Array<{ contentScheduleId: string; publishingJobId: string }>;
  skipped: Array<{ contentScheduleId: string; reason: PublishingSchedulerSkipReason }>;
};

export const publishingSchedulerService = {
  /**
   * Converts due ContentSchedule rows (status READY, scheduledFor <= now) into durable
   * PublishingJob records. Eligibility mirrors what the worker can actually publish.
   */
  async enqueueDueSchedules(now = new Date()): Promise<PublishingSchedulerOutcome> {
    const config = getPublishingConfig();
    const outcome: PublishingSchedulerOutcome = { enqueued: [], skipped: [] };

    if (!config.schedulerEnabled) {
      logger.warn("publishing.scheduler_disabled", { now: now.toISOString() });
      return outcome;
    }

    const schedules = await prisma.contentSchedule.findMany({
      where: {
        status: "READY",
        scheduledFor: { lte: now },
        socialAccount: {
          status: "CONNECTED",
          socialConnection: {
            status: "CONNECTED",
            reconnectRequiredAt: null,
          },
        },
        contentItem: {
          status: { in: ["APPROVED", "SCHEDULED"] },
          archivedAt: null,
          brand: {
            status: "ACTIVE",
            archivedAt: null,
            organisation: { status: "ACTIVE", archivedAt: null },
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
      take: config.maxSchedulesPerRun,
      include: {
        contentVariant: { select: { provider: true, format: true } },
        socialAccount: { include: { capabilities: { select: { capability: true } } } },
      },
    });

    for (const schedule of schedules) {
      const provider = schedule.contentVariant.provider;

      if (isProviderPublishingDisabled(provider)) {
        outcome.skipped.push({ contentScheduleId: schedule.id, reason: "PROVIDER_DISABLED" });
        incrementPublishingCounter("publishing.provider_shutdown_skipped", 1, {
          contentScheduleId: schedule.id,
          provider,
        });
        continue;
      }

      const granted = schedule.socialAccount.capabilities.map(
        (row: { capability: SocialCapability }) => row.capability,
      );
      if (
        !accountHasPublishingCapability(schedule.contentVariant.format, granted)
      ) {
        outcome.skipped.push({ contentScheduleId: schedule.id, reason: "CAPABILITY_BLOCKED" });
        incrementPublishingCounter("publishing.capability_blocked", 1, {
          contentScheduleId: schedule.id,
          provider,
          format: schedule.contentVariant.format,
        });
        continue;
      }

      const idempotencyKey = scheduledJobIdempotencyKey(schedule.id);
      const existingJob = await prisma.publishingJob.findFirst({
        where: { contentScheduleId: schedule.id, idempotencyKey },
        select: { id: true },
      });
      if (existingJob) {
        outcome.skipped.push({ contentScheduleId: schedule.id, reason: "ALREADY_ENQUEUED" });
        incrementPublishingCounter("publishing.scheduled_jobs_skipped", 1, {
          contentScheduleId: schedule.id,
          reason: "ALREADY_ENQUEUED",
        });
        continue;
      }

      const job = await prisma.publishingJob.create({
        data: {
          organisationId: schedule.organisationId,
          projectId: schedule.projectId,
          brandId: schedule.brandId,
          contentScheduleId: schedule.id,
          idempotencyKey,
          status: "QUEUED",
        },
      });

      await prisma.contentSchedule.update({
        where: { id: schedule.id },
        data: { status: "QUEUED" },
      });

      outcome.enqueued.push({ contentScheduleId: schedule.id, publishingJobId: job.id });
      incrementPublishingCounter("publishing.scheduled_jobs_enqueued", 1, {
        contentScheduleId: schedule.id,
        publishingJobId: job.id,
        organisationId: schedule.organisationId,
        brandId: schedule.brandId,
        provider,
      });
    }

    logger.info("publishing.scheduler_run", {
      now: now.toISOString(),
      enqueued: outcome.enqueued.length,
      skipped: outcome.skipped.length,
    });
    return outcome;
  },

  /** Drains due publishing jobs (queued or polling) up to the configured batch size. */
  async processDue(limit = getPublishingConfig().maxJobsPerWorkerRun, workerId?: string) {
    const now = new Date();
    const take = Math.min(Math.max(limit, 1), 50);
    const due = await prisma.publishingJob.findMany({
      where: {
        OR: [
          { status: "QUEUED" },
          { status: "PROCESSING", OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }] },
        ],
      },
      orderBy: { createdAt: "asc" },
      take,
      select: { id: true },
    });

    const results = [];
    for (const item of due) {
      const result = await processPublishingJob(item.id);
      incrementPublishingCounter("publishing.jobs_processed", 1, {
        jobId: item.id,
        workerId,
        state: result && "state" in result ? result.state : "null",
      });
      if (result && "state" in result) {
        if (result.state === "FAILED") {
          incrementPublishingCounter("publishing.jobs_failed", 1, { jobId: item.id });
        } else if (result.state === "PUBLISHED" || result.state === "ALREADY_PUBLISHED") {
          incrementPublishingCounter("publishing.completed_jobs", 1, { jobId: item.id });
        } else if (
          result.state === "PROCESSING" ||
          result.state === "REQUEUED_AFTER_REFRESH"
        ) {
          incrementPublishingCounter("publishing.jobs_requeued", 1, { jobId: item.id });
        } else if (result.state === "MANUAL_FALLBACK_REQUIRED") {
          incrementPublishingCounter("publishing.manual_fallback_required", 1, {
            jobId: item.id,
          });
        }
      }
      results.push({ jobId: item.id, result });
    }
    return results;
  },

  /** Cron entry point: enqueue due schedules, then drain due publishing jobs. */
  async runSchedulerPass(input?: { now?: Date; limit?: number; workerId?: string }) {
    const scheduled = await this.enqueueDueSchedules(input?.now);
    const processed = await this.processDue(
      input?.limit ?? getPublishingConfig().maxJobsPerWorkerRun,
      input?.workerId,
    );
    return { scheduled, processed };
  },
};
