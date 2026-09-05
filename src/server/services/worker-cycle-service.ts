import { randomUUID } from "node:crypto";
import {
  evaluateScheduledExecutionGate,
  FALLBACK_SCHEDULER_SOURCE,
  LAUNCH_SCHEDULER_FALLBACK_STALE_MS,
  PRIMARY_SCHEDULER_SOURCE,
} from "@/lib/deployment/scheduling";
import { logger } from "@/lib/logging";
import { getPublishingConfig } from "@/lib/publishing/config";
import { getWorkerPlatformConfig } from "@/lib/workers/config";
import { automationScheduleService } from "@/server/services/automation-schedule-service";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";
import {
  schedulerHealthService,
  type SchedulerSource,
} from "@/server/services/scheduler-health-service";
import { workerDispatcherService } from "@/server/services/worker-dispatcher-service";
import { workerExecutorService } from "@/server/services/worker-executor-service";
import { workerJobService } from "@/server/services/worker-job-service";

export type WorkerCycleSource = SchedulerSource;

export type WorkerCyclePublishingResult = {
  scheduledEnqueued: number;
  scheduledSkipped: number;
  jobsProcessed: number;
};

export type WorkerCycleResult = {
  cycleId: string;
  source: WorkerCycleSource;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  degraded: boolean;
  skipped: boolean;
  skipReason?: string;
  gate?: ReturnType<typeof evaluateScheduledExecutionGate>;
  recover: { recovered: number };
  dispatch: Awaited<ReturnType<typeof workerDispatcherService.dispatchDueJobs>>;
  automation: Awaited<ReturnType<typeof automationScheduleService.dispatchDueSchedules>>;
  process: Awaited<ReturnType<typeof workerExecutorService.processAvailableJobs>>;
  publishing?: WorkerCyclePublishingResult;
  publishingError?: string;
};

const EMPTY_DISPATCH = {
  discovered: 0,
  created: 0,
  activated: 0,
  skipped: 0,
  byType: {},
} as Awaited<ReturnType<typeof workerDispatcherService.dispatchDueJobs>>;

const EMPTY_AUTOMATION = {
  evaluated: 0,
  triggered: 0,
  skipped: 0,
  executionIds: [] as string[],
};

const EMPTY_PROCESS = {
  claimed: 0,
  succeeded: 0,
  failed: 0,
  retrying: 0,
  skipped: 0,
  deadLettered: 0,
  durationMs: 0,
};

function mapPublishingPass(
  pass: Awaited<ReturnType<typeof publishingSchedulerService.runSchedulerPass>>,
): WorkerCyclePublishingResult {
  return {
    scheduledEnqueued: pass.scheduled.enqueued.length,
    scheduledSkipped: pass.scheduled.skipped.length,
    jobsProcessed: pass.processed.length,
  };
}

async function recordSkippedCycle(input: {
  cycleId: string;
  source: WorkerCycleSource;
  startedAt: Date;
  skipReason: string;
  gate?: ReturnType<typeof evaluateScheduledExecutionGate>;
}): Promise<WorkerCycleResult> {
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - input.startedAt.getTime();
  await schedulerHealthService.recordCycle({
    cycleId: input.cycleId,
    source: input.source,
    startedAt: input.startedAt,
    completedAt,
    durationMs,
    success: true,
    skipped: true,
    skipReason: input.skipReason,
  });

  return {
    cycleId: input.cycleId,
    source: input.source,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs,
    success: true,
    degraded: false,
    skipped: true,
    skipReason: input.skipReason,
    gate: input.gate,
    recover: { recovered: 0 },
    dispatch: EMPTY_DISPATCH,
    automation: EMPTY_AUTOMATION,
    process: EMPTY_PROCESS,
  };
}

export const workerCycleService = {
  async run(input?: {
    cycleId?: string;
    source?: WorkerCycleSource;
    workerId?: string;
    limit?: number;
    includeLegacyPublishing?: boolean;
    fallbackOnlyIfStale?: boolean;
  }): Promise<WorkerCycleResult> {
    const cycleId = input?.cycleId ?? randomUUID();
    const source = input?.source ?? PRIMARY_SCHEDULER_SOURCE;
    const startedAt = new Date();
    const config = getWorkerPlatformConfig();
    const limit = input?.limit ?? config.maxJobsPerInvocation;
    const workerId = input?.workerId ?? `worker-cycle-${cycleId}`;

    if (input?.fallbackOnlyIfStale) {
      const health = await schedulerHealthService.getHealth(startedAt);
      const lagMs = health.lagMs ?? Number.POSITIVE_INFINITY;
      if (!health.missedHeartbeat && lagMs < LAUNCH_SCHEDULER_FALLBACK_STALE_MS) {
        return recordSkippedCycle({
          cycleId,
          source,
          startedAt,
          skipReason: "PRIMARY_HEALTHY",
        });
      }
    }

    const gate = evaluateScheduledExecutionGate();
    if (!gate.allowed && source === PRIMARY_SCHEDULER_SOURCE) {
      return recordSkippedCycle({
        cycleId,
        source,
        startedAt,
        skipReason: gate.reason ?? "GATE_BLOCKED",
        gate,
      });
    }

    let publishingError: string | undefined;
    let publishing: WorkerCyclePublishingResult | undefined;
    let degraded = false;

    try {
      const recovered = await workerJobService.recoverExpiredJobs(startedAt);
      const dispatch = await workerDispatcherService.dispatchDueJobs({ limit });
      const automation = await automationScheduleService.dispatchDueSchedules(startedAt, limit);
      const process = await workerExecutorService.processAvailableJobs({ workerId, limit });

      if (input?.includeLegacyPublishing !== false) {
        const publishingConfig = getPublishingConfig();
        if (publishingConfig.schedulerEnabled) {
          try {
            const pass = await publishingSchedulerService.runSchedulerPass({
              limit: publishingConfig.maxJobsPerWorkerRun,
              workerId,
            });
            publishing = mapPublishingPass(pass);
          } catch (error) {
            publishingError = error instanceof Error ? error.message : String(error);
            degraded = true;
            logger.error("worker_cycle.publishing_degraded", {
              cycleId,
              source,
              error: publishingError,
            });
          }
        }
      }

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const success = !degraded;

      await schedulerHealthService.recordCycle({
        cycleId,
        source,
        startedAt,
        completedAt,
        durationMs,
        success,
        skipped: false,
        degraded,
        publishingError,
        recover: recovered,
        dispatch: {
          discovered: dispatch.discovered,
          created: dispatch.created,
          activated: dispatch.activated,
          skipped: dispatch.skipped,
        },
        automation,
        process: {
          claimed: process.claimed,
          succeeded: process.succeeded,
          failed: process.failed,
          retrying: process.retrying,
        },
        publishing,
      });

      return {
        cycleId,
        source,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        success,
        degraded,
        skipped: false,
        recover: { recovered },
        dispatch,
        automation,
        process,
        publishing,
        publishingError,
      };
    } catch (error) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const message = error instanceof Error ? error.message : String(error);

      await schedulerHealthService.recordCycle({
        cycleId,
        source,
        startedAt,
        completedAt,
        durationMs,
        success: false,
        skipped: false,
        degraded: true,
        error: message,
      });

      logger.error("worker_cycle.failed", { cycleId, source, error: message });
      throw error;
    }
  },
};

export { FALLBACK_SCHEDULER_SOURCE, PRIMARY_SCHEDULER_SOURCE };
