import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";
import { operationalAlertService } from "@/server/services/operational-alert-service";

const HEARTBEAT_ID = "global";
const MISSED_HEARTBEAT_MS = 15 * 60_000;

export type SchedulerInvocationType = "dispatch" | "process" | "full_cycle";

export type SchedulerHeartbeatRecord = {
  id: string;
  lastInvokedAt: Date;
  lastSucceededAt: Date | null;
  invocationType: string;
  jobsDiscovered: number;
  jobsCreated: number;
  jobsActivated: number;
  jobsClaimed: number;
  jobsSucceeded: number;
  oldestReadyDueAt: Date | null;
  metadata: unknown;
  updatedAt: Date;
};

export type SchedulerHealthSnapshot = {
  heartbeat: SchedulerHeartbeatRecord | null;
  lagMs: number | null;
  missedHeartbeat: boolean;
  readyJobCount: number;
  runningJobCount: number;
  retryJobCount: number;
  oldestReadyDueAt: string | null;
  schedulerSlaMinutes: number;
};

export const SCHEDULER_SLA_MINUTES = 10;

async function queryOldestReadyDueAt(): Promise<Date | null> {
  const oldest = await prisma.workerJob.findFirst({
    where: { status: { in: ["READY", "SCHEDULED", "RETRY_WAIT"] } },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  return oldest?.dueAt ?? null;
}

async function upsertHeartbeat(input: {
  invocationType: SchedulerInvocationType;
  succeeded: boolean;
  jobsDiscovered?: number;
  jobsCreated?: number;
  jobsActivated?: number;
  jobsClaimed?: number;
  jobsSucceeded?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  const oldestReadyDueAt = await queryOldestReadyDueAt();

  await prisma.$executeRaw`
    INSERT INTO "SchedulerHeartbeat" (
      "id", "lastInvokedAt", "lastSucceededAt", "invocationType",
      "jobsDiscovered", "jobsCreated", "jobsActivated", "jobsClaimed", "jobsSucceeded",
      "oldestReadyDueAt", "metadata", "updatedAt"
    ) VALUES (
      ${HEARTBEAT_ID}, ${now}, ${input.succeeded ? now : null}, ${input.invocationType},
      ${input.jobsDiscovered ?? 0}, ${input.jobsCreated ?? 0}, ${input.jobsActivated ?? 0},
      ${input.jobsClaimed ?? 0}, ${input.jobsSucceeded ?? 0},
      ${oldestReadyDueAt}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${now}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "lastInvokedAt" = EXCLUDED."lastInvokedAt",
      "lastSucceededAt" = COALESCE(EXCLUDED."lastSucceededAt", "SchedulerHeartbeat"."lastSucceededAt"),
      "invocationType" = EXCLUDED."invocationType",
      "jobsDiscovered" = EXCLUDED."jobsDiscovered",
      "jobsCreated" = EXCLUDED."jobsCreated",
      "jobsActivated" = EXCLUDED."jobsActivated",
      "jobsClaimed" = EXCLUDED."jobsClaimed",
      "jobsSucceeded" = EXCLUDED."jobsSucceeded",
      "oldestReadyDueAt" = EXCLUDED."oldestReadyDueAt",
      "metadata" = EXCLUDED."metadata",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function readHeartbeat(): Promise<SchedulerHeartbeatRecord | null> {
  const rows = await prisma.$queryRaw<SchedulerHeartbeatRecord[]>`
    SELECT
      "id",
      "lastInvokedAt",
      "lastSucceededAt",
      "invocationType",
      "jobsDiscovered",
      "jobsCreated",
      "jobsActivated",
      "jobsClaimed",
      "jobsSucceeded",
      "oldestReadyDueAt",
      "metadata",
      "updatedAt"
    FROM "SchedulerHeartbeat"
    WHERE "id" = ${HEARTBEAT_ID}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export const schedulerHealthService = {
  async recordDispatch(summary: {
    discovered: number;
    created: number;
    activated: number;
    skipped: number;
  }) {
    await upsertHeartbeat({
      invocationType: "dispatch",
      succeeded: true,
      jobsDiscovered: summary.discovered,
      jobsCreated: summary.created,
      jobsActivated: summary.activated,
      metadata: { skipped: summary.skipped },
    });
  },

  async recordProcess(summary: {
    claimed: number;
    succeeded: number;
    failed: number;
    retrying: number;
  }) {
    await upsertHeartbeat({
      invocationType: "process",
      succeeded: true,
      jobsClaimed: summary.claimed,
      jobsSucceeded: summary.succeeded,
      metadata: { failed: summary.failed, retrying: summary.retrying },
    });
  },

  async getHealth(now = new Date()): Promise<SchedulerHealthSnapshot> {
    const [heartbeat, readyJobCount, runningJobCount, retryJobCount, oldestReady] =
      await Promise.all([
        readHeartbeat(),
        prisma.workerJob.count({ where: { status: "READY" } }),
        prisma.workerJob.count({ where: { status: "RUNNING" } }),
        prisma.workerJob.count({ where: { status: "RETRY_WAIT" } }),
        queryOldestReadyDueAt(),
      ]);

    const lagMs = heartbeat ? now.getTime() - heartbeat.lastInvokedAt.getTime() : null;
    const missedHeartbeat = lagMs !== null && lagMs > MISSED_HEARTBEAT_MS;

    return {
      heartbeat,
      lagMs,
      missedHeartbeat,
      readyJobCount,
      runningJobCount,
      retryJobCount,
      oldestReadyDueAt: oldestReady?.toISOString() ?? heartbeat?.oldestReadyDueAt?.toISOString() ?? null,
      schedulerSlaMinutes: SCHEDULER_SLA_MINUTES,
    };
  },

  async evaluateSchedulerAlerts(now = new Date()): Promise<number> {
    const health = await this.getHealth(now);
    if (!health.missedHeartbeat) {
      return 0;
    }

    const organisations = await prisma.organisation.findMany({
      where: { status: "ACTIVE", archivedAt: null },
      select: { id: true },
      take: 5,
    });

    let alerts = 0;
    for (const organisation of organisations) {
      await operationalAlertService.upsert({
        organisationId: organisation.id,
        alertType: "SYSTEM",
        category: "SYSTEM",
        resourceType: "SchedulerHeartbeat",
        resourceId: HEARTBEAT_ID,
        title: "Background scheduler has not executed for 15 minutes",
        safeErrorMessage:
          "The canonical worker dispatcher has not recorded a heartbeat within the expected window. Scheduled publications and background jobs may be delayed.",
        recommendedAction: "VERIFY_SCHEDULER",
        attemptCount: 1,
        maxAttempts: 3,
        idempotencyKey: `scheduler-missed:${now.toISOString().slice(0, 13)}`,
        metadata: {
          lagMs: health.lagMs,
          readyJobCount: health.readyJobCount,
          oldestReadyDueAt: health.oldestReadyDueAt,
        },
      });
      alerts += 1;
    }

    logger.warn("scheduler.heartbeat_missed", {
      lagMs: health.lagMs,
      readyJobCount: health.readyJobCount,
    });

    return alerts;
  },
};
