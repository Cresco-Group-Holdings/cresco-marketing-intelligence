import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";
import { operationalAlertService } from "@/server/services/operational-alert-service";

const HEARTBEAT_ID = "global";
const MISSED_HEARTBEAT_MS = 15 * 60_000;
const MAX_RECENT_CYCLES = 24;

export type SchedulerSource =
  | "vercel_cron"
  | "github_actions_fallback"
  | "daily_dispatch"
  | "manual"
  | "recover"
  | "dispatch"
  | "process";

export type SchedulerInvocationType = "dispatch" | "process" | "full_cycle" | "recover" | "daily_dispatch";

export type SchedulerCycleHistoryEntry = {
  cycleId: string;
  source: SchedulerSource;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  skipped?: boolean;
  skipReason?: string;
  degraded?: boolean;
  error?: string;
};

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
  recentCycles: SchedulerCycleHistoryEntry[];
  primarySource: string | null;
};

export const SCHEDULER_SLA_MINUTES = 10;

type HeartbeatMetadata = {
  source?: SchedulerSource;
  cycleId?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  success?: boolean;
  skipped?: boolean;
  skipReason?: string;
  degraded?: boolean;
  error?: string;
  recentCycles?: SchedulerCycleHistoryEntry[];
  [key: string]: unknown;
};

async function queryOldestReadyDueAt(): Promise<Date | null> {
  const oldest = await prisma.workerJob.findFirst({
    where: { status: { in: ["READY", "SCHEDULED", "RETRY_WAIT"] } },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  return oldest?.dueAt ?? null;
}

function parseMetadata(metadata: unknown): HeartbeatMetadata {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as HeartbeatMetadata;
  }
  return {};
}

function appendRecentCycle(
  metadata: HeartbeatMetadata,
  entry: SchedulerCycleHistoryEntry,
): SchedulerCycleHistoryEntry[] {
  const recent = Array.isArray(metadata.recentCycles) ? [...metadata.recentCycles] : [];
  recent.unshift(entry);
  return recent.slice(0, MAX_RECENT_CYCLES);
}

async function upsertHeartbeat(input: {
  invocationType: SchedulerInvocationType;
  succeeded: boolean;
  jobsDiscovered?: number;
  jobsCreated?: number;
  jobsActivated?: number;
  jobsClaimed?: number;
  jobsSucceeded?: number;
  metadata?: HeartbeatMetadata;
}): Promise<void> {
  const now = new Date();
  const oldestReadyDueAt = await queryOldestReadyDueAt();
  const metadata = input.metadata ?? {};

  await prisma.$executeRaw`
    INSERT INTO "SchedulerHeartbeat" (
      "id", "lastInvokedAt", "lastSucceededAt", "invocationType",
      "jobsDiscovered", "jobsCreated", "jobsActivated", "jobsClaimed", "jobsSucceeded",
      "oldestReadyDueAt", "metadata", "updatedAt"
    ) VALUES (
      ${HEARTBEAT_ID}, ${now}, ${input.succeeded ? now : null}, ${input.invocationType},
      ${input.jobsDiscovered ?? 0}, ${input.jobsCreated ?? 0}, ${input.jobsActivated ?? 0},
      ${input.jobsClaimed ?? 0}, ${input.jobsSucceeded ?? 0},
      ${oldestReadyDueAt}, ${JSON.stringify(metadata)}::jsonb, ${now}
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
    source?: SchedulerSource;
    cycleId?: string;
  }) {
    await upsertHeartbeat({
      invocationType: "dispatch",
      succeeded: true,
      jobsDiscovered: summary.discovered,
      jobsCreated: summary.created,
      jobsActivated: summary.activated,
      metadata: {
        source: summary.source ?? "dispatch",
        cycleId: summary.cycleId,
        skippedCount: summary.skipped,
      },
    });
  },

  async recordProcess(summary: {
    claimed: number;
    succeeded: number;
    failed: number;
    retrying: number;
    source?: SchedulerSource;
    cycleId?: string;
  }) {
    await upsertHeartbeat({
      invocationType: "process",
      succeeded: true,
      jobsClaimed: summary.claimed,
      jobsSucceeded: summary.succeeded,
      metadata: {
        source: summary.source ?? "process",
        cycleId: summary.cycleId,
        failed: summary.failed,
        retrying: summary.retrying,
      },
    });
  },

  async recordRecover(input: { recovered: number; source?: SchedulerSource; cycleId?: string }) {
    await upsertHeartbeat({
      invocationType: "recover",
      succeeded: true,
      metadata: {
        source: input.source ?? "recover",
        cycleId: input.cycleId,
        recovered: input.recovered,
      },
    });
  },

  async recordCycle(input: {
    cycleId: string;
    source: SchedulerSource;
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    success: boolean;
    skipped?: boolean;
    skipReason?: string;
    degraded?: boolean;
    error?: string;
    publishingError?: string;
    recover?: number;
    dispatch?: {
      discovered: number;
      created: number;
      activated: number;
      skipped: number;
    };
    automation?: {
      evaluated: number;
      triggered: number;
      skipped: number;
      executionIds: string[];
    };
    process?: {
      claimed: number;
      succeeded: number;
      failed: number;
      retrying: number;
    };
    publishing?: {
      scheduledEnqueued: number;
      scheduledSkipped: number;
      jobsProcessed: number;
    };
  }) {
    const heartbeat = await readHeartbeat();
    const existing = parseMetadata(heartbeat?.metadata);

    const historyEntry: SchedulerCycleHistoryEntry = {
      cycleId: input.cycleId,
      source: input.source,
      startedAt: input.startedAt.toISOString(),
      completedAt: input.completedAt.toISOString(),
      durationMs: input.durationMs,
      success: input.success,
      skipped: input.skipped,
      skipReason: input.skipReason,
      degraded: input.degraded,
      error: input.error ?? input.publishingError,
    };

    const recentCycles = appendRecentCycle(existing, historyEntry);

    await upsertHeartbeat({
      invocationType: "full_cycle",
      succeeded: input.success && !input.degraded,
      jobsDiscovered:
        (input.dispatch?.discovered ?? 0) + (input.automation?.evaluated ?? 0),
      jobsCreated: (input.dispatch?.created ?? 0) + (input.automation?.triggered ?? 0),
      jobsActivated: input.automation?.executionIds.length ?? 0,
      jobsClaimed: input.process?.claimed ?? 0,
      jobsSucceeded: input.process?.succeeded ?? 0,
      metadata: {
        source: input.source,
        cycleId: input.cycleId,
        startedAt: input.startedAt.toISOString(),
        completedAt: input.completedAt.toISOString(),
        durationMs: input.durationMs,
        success: input.success,
        skipped: input.skipped,
        skipReason: input.skipReason,
        degraded: input.degraded,
        error: input.error,
        publishingError: input.publishingError,
        recover: input.recover,
        recentCycles,
        dispatch: input.dispatch,
        automation: input.automation,
        process: input.process,
        publishing: input.publishing,
      },
    });
  },

  async recordDailyDispatch(input: {
    cycleId: string;
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    success: boolean;
    jobSummaries: Array<{ jobId: string; passes: number; stoppedReason: string }>;
  }) {
    const heartbeat = await readHeartbeat();
    const existing = parseMetadata(heartbeat?.metadata);
    const historyEntry: SchedulerCycleHistoryEntry = {
      cycleId: input.cycleId,
      source: "daily_dispatch",
      startedAt: input.startedAt.toISOString(),
      completedAt: input.completedAt.toISOString(),
      durationMs: input.durationMs,
      success: input.success,
    };
    const recentCycles = appendRecentCycle(existing, historyEntry);

    await upsertHeartbeat({
      invocationType: "daily_dispatch",
      succeeded: input.success,
      metadata: {
        source: "daily_dispatch",
        cycleId: input.cycleId,
        startedAt: input.startedAt.toISOString(),
        completedAt: input.completedAt.toISOString(),
        durationMs: input.durationMs,
        success: input.success,
        jobs: input.jobSummaries,
        recentCycles,
      },
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

    const metadata = parseMetadata(heartbeat?.metadata);
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
      recentCycles: metadata.recentCycles ?? [],
      primarySource: metadata.source ?? null,
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
          primarySource: health.primarySource,
        },
      });
      alerts += 1;
    }

    logger.warn("scheduler.heartbeat_missed", {
      lagMs: health.lagMs,
      readyJobCount: health.readyJobCount,
      primarySource: health.primarySource,
    });

    return alerts;
  },
};
