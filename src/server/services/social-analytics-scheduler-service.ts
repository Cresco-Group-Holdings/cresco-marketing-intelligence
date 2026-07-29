import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";
import {
  getAnalyticsSyncConfig,
  scheduleWindowStart,
  scheduledSyncIdempotencyKey,
} from "@/lib/analytics/config";
import { incrementAnalyticsCounter } from "@/lib/analytics/observability";
import { socialAnalyticsSyncService } from "@/server/services/social-analytics-sync-service";

export type SchedulerSkipReason =
  | "SCHEDULER_DISABLED"
  | "ALREADY_SCHEDULED"
  | "ENTITLEMENT_BLOCKED";

export type SchedulerOutcome = {
  windowStart: string;
  enqueued: Array<{ socialAccountId: string; syncId: string; syncType: "INITIAL" | "SCHEDULED" }>;
  skipped: Array<{ socialAccountId: string; reason: SchedulerSkipReason }>;
};

export const socialAnalyticsSchedulerService = {
  /**
   * Enqueues one recurring analytics sync per eligible account for the current schedule window.
   * Eligibility deliberately mirrors what the provider will actually answer: a live connection, an
   * insights capability, an active brand, and an active organisation.
   */
  async enqueueDueAccounts(now = new Date()): Promise<SchedulerOutcome> {
    const config = getAnalyticsSyncConfig();
    const windowStart = scheduleWindowStart(now, config.intervalMinutes);
    const outcome: SchedulerOutcome = {
      windowStart: windowStart.toISOString(),
      enqueued: [],
      skipped: [],
    };

    if (!config.schedulerEnabled) {
      logger.warn("analytics.scheduler_disabled", { windowStart: outcome.windowStart });
      return outcome;
    }

    const accounts = await prisma.socialAccount.findMany({
      where: {
        status: "CONNECTED",
        socialConnection: {
          status: "CONNECTED",
          reconnectRequiredAt: null,
        },
        capabilities: { some: { capability: "READ_INSIGHTS" } },
        brand: {
          status: "ACTIVE",
          archivedAt: null,
          organisation: { status: "ACTIVE", archivedAt: null },
        },
      },
      orderBy: { createdAt: "asc" },
      take: config.maxAccountsPerSchedulerRun,
      select: {
        id: true,
        organisationId: true,
        projectId: true,
        brandId: true,
        provider: true,
      },
    });

    for (const account of accounts) {
      const idempotencyKey = scheduledSyncIdempotencyKey(account.id, windowStart);
      const existing = await prisma.socialAnalyticsSync.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        outcome.skipped.push({ socialAccountId: account.id, reason: "ALREADY_SCHEDULED" });
        incrementAnalyticsCounter("analytics.scheduled_jobs_skipped", 1, {
          socialAccountId: account.id,
          reason: "ALREADY_SCHEDULED",
        });
        continue;
      }

      // The first scheduled run for an account performs the historical backfill.
      const previous = await prisma.socialAnalyticsSync.findFirst({
        where: { socialAccountId: account.id, status: { in: ["COMPLETED", "PARTIAL"] } },
        select: { id: true },
      });
      const syncType = previous ? "SCHEDULED" : "INITIAL";
      const backfillTo = previous ? undefined : windowStart;
      const backfillFrom = previous
        ? undefined
        : new Date(windowStart.getTime() - config.backfillDays * 86_400_000);

      const sync = await prisma.socialAnalyticsSync.create({
        data: {
          organisationId: account.organisationId,
          projectId: account.projectId,
          brandId: account.brandId,
          socialAccountId: account.id,
          provider: account.provider,
          syncType,
          idempotencyKey,
          scheduledFor: windowStart,
          backfillFrom,
          backfillTo,
        },
      });

      outcome.enqueued.push({ socialAccountId: account.id, syncId: sync.id, syncType });
      incrementAnalyticsCounter("analytics.scheduled_jobs_enqueued", 1, {
        socialAccountId: account.id,
        organisationId: account.organisationId,
        brandId: account.brandId,
        provider: account.provider,
        syncType,
      });
    }

    logger.info("analytics.scheduler_run", {
      windowStart: outcome.windowStart,
      enqueued: outcome.enqueued.length,
      skipped: outcome.skipped.length,
      intervalMinutes: config.intervalMinutes,
    });
    return outcome;
  },

  /** Convenience entry point for the cron worker: enqueue the window, then drain due work. */
  async runSchedulerPass(input?: { now?: Date; limit?: number; workerId?: string }) {
    const scheduled = await this.enqueueDueAccounts(input?.now);
    const processed = await socialAnalyticsSyncService.processDue(
      input?.limit ?? getAnalyticsSyncConfig().maxSyncsPerWorkerRun,
      input?.workerId,
    );
    return { scheduled, processed };
  },
};
