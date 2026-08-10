import { logger } from "@/lib/logging";
import {
  INTERNAL_CRON_JOBS,
  type InternalCronJobId,
  evaluateScheduledExecutionGate,
  getDailyDispatchLimits,
} from "@/lib/deployment/scheduling";
import { getPublishingConfig } from "@/lib/publishing/config";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";

export type DailyDispatchJobResult = {
  jobId: InternalCronJobId;
  passes: number;
  stoppedReason: "IDLE" | "PASS_LIMIT" | "DURATION_LIMIT" | "DISABLED";
  lastPass?: {
    scheduledEnqueued: number;
    scheduledSkipped: number;
    jobsProcessed: number;
  };
};

export type DailyDispatchResult = {
  gate: ReturnType<typeof evaluateScheduledExecutionGate>;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  jobs: DailyDispatchJobResult[];
};

async function runPublishingPasses(input: {
  maxPasses: number;
  deadlineMs: number;
  workerId: string;
}): Promise<DailyDispatchJobResult> {
  const config = getPublishingConfig();
  if (!config.schedulerEnabled) {
    return { jobId: "publishing", passes: 0, stoppedReason: "DISABLED" };
  }

  let passes = 0;
  let lastPass: DailyDispatchJobResult["lastPass"];

  while (passes < input.maxPasses && Date.now() < input.deadlineMs) {
    const pass = await publishingSchedulerService.runSchedulerPass({
      limit: config.maxJobsPerWorkerRun,
      workerId: input.workerId,
    });

    passes += 1;
    lastPass = {
      scheduledEnqueued: pass.scheduled.enqueued.length,
      scheduledSkipped: pass.scheduled.skipped.length,
      jobsProcessed: pass.processed.length,
    };

    const didWork =
      pass.scheduled.enqueued.length > 0 ||
      pass.scheduled.skipped.length > 0 ||
      pass.processed.length > 0;

    if (!didWork) {
      return { jobId: "publishing", passes, stoppedReason: "IDLE", lastPass };
    }
  }

  const stoppedReason =
    Date.now() >= input.deadlineMs ? "DURATION_LIMIT" : "PASS_LIMIT";

  return { jobId: "publishing", passes, stoppedReason, lastPass };
}

export const dailyCronDispatchService = {
  async run(input?: { workerId?: string; jobIds?: InternalCronJobId[] }): Promise<DailyDispatchResult> {
    const startedAt = new Date();
    const gate = evaluateScheduledExecutionGate();
    const limits = getDailyDispatchLimits();
    const deadlineMs = startedAt.getTime() + limits.maxDurationMs;
    const workerId = input?.workerId ?? `daily-dispatch-${startedAt.toISOString()}`;

    const jobs: DailyDispatchJobResult[] = [];

    if (!gate.allowed) {
      logger.info("cron.daily_dispatch_skipped", { reason: gate.reason, workerId });
      const completedAt = new Date();
      return {
        gate,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        jobs,
      };
    }

    const selected = input?.jobIds ?? (Object.keys(INTERNAL_CRON_JOBS) as InternalCronJobId[]);
    let totalPasses = 0;

    for (const jobId of selected) {
      if (totalPasses >= limits.maxTotalPasses || Date.now() >= deadlineMs) {
        break;
      }

      const definition = INTERNAL_CRON_JOBS[jobId];
      const remainingPasses = Math.min(
        definition.maxPassesPerDailyDispatch,
        limits.maxTotalPasses - totalPasses,
        limits.maxPassesPerJob,
      );

      if (jobId === "publishing") {
        const result = await runPublishingPasses({
          maxPasses: remainingPasses,
          deadlineMs,
          workerId,
        });
        totalPasses += result.passes;
        jobs.push(result);
      }
    }

    const completedAt = new Date();
    logger.info("cron.daily_dispatch_completed", {
      workerId,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      jobs: jobs.map((job) => ({
        jobId: job.jobId,
        passes: job.passes,
        stoppedReason: job.stoppedReason,
      })),
    });

    return {
      gate,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      jobs,
    };
  },
};
