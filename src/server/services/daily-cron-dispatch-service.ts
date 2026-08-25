import { logger } from "@/lib/logging";
import {
  INTERNAL_CRON_JOBS,
  type InternalCronJobId,
  evaluateScheduledExecutionGate,
  getDailyDispatchLimits,
} from "@/lib/deployment/scheduling";
import { getPublishingConfig } from "@/lib/publishing/config";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";
import { workerDispatcherService } from "@/server/services/worker-dispatcher-service";
import { workerExecutorService } from "@/server/services/worker-executor-service";
import { automationScheduleService } from "@/server/services/automation-schedule-service";
import { backgroundIntelligenceService } from "@/server/services/background-intelligence-service";

export type DailyDispatchJobResult = {
  jobId: InternalCronJobId;
  passes: number;
  stoppedReason: "IDLE" | "PASS_LIMIT" | "DURATION_LIMIT" | "DISABLED";
  lastPass?: Record<string, unknown>;
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
    const dispatch = await workerDispatcherService.dispatchDueJobs();
    const worker = await workerExecutorService.processAvailableJobs({
      workerId: input.workerId,
      deadlineMs: input.deadlineMs,
    });

    const pass = await publishingSchedulerService.runSchedulerPass({
      limit: config.maxJobsPerWorkerRun,
      workerId: input.workerId,
    });

    passes += 1;
    lastPass = {
      scheduledEnqueued: pass.scheduled.enqueued.length,
      scheduledSkipped: pass.scheduled.skipped.length,
      jobsProcessed: pass.processed.length,
      dispatch,
      worker,
    };

    const didWork =
      pass.scheduled.enqueued.length > 0 ||
      pass.scheduled.skipped.length > 0 ||
      pass.processed.length > 0 ||
      dispatch.created > 0 ||
      worker.claimed > 0;

    if (!didWork) {
      return { jobId: "publishing", passes, stoppedReason: "IDLE", lastPass };
    }
  }

  const stoppedReason =
    Date.now() >= input.deadlineMs ? "DURATION_LIMIT" : "PASS_LIMIT";

  return { jobId: "publishing", passes, stoppedReason, lastPass };
}

async function runWorkerDispatchPasses(input: {
  maxPasses: number;
  deadlineMs: number;
  workerId: string;
}): Promise<DailyDispatchJobResult> {
  let passes = 0;
  let lastDispatch: Awaited<ReturnType<typeof workerDispatcherService.dispatchDueJobs>> | undefined;
  let lastWorker: Awaited<ReturnType<typeof workerExecutorService.processAvailableJobs>> | undefined;

  while (passes < input.maxPasses && Date.now() < input.deadlineMs) {
    const dispatch = await workerDispatcherService.dispatchDueJobs();
    const worker = await workerExecutorService.processAvailableJobs({
      workerId: input.workerId,
      deadlineMs: input.deadlineMs,
    });
    passes += 1;
    lastDispatch = dispatch;
    lastWorker = worker;

    const didWork = dispatch.created > 0 || worker.claimed > 0;
    if (!didWork) {
      return {
        jobId: "worker_dispatch",
        passes,
        stoppedReason: "IDLE",
        lastPass: { dispatch, worker },
      };
    }
  }

  return {
    jobId: "worker_dispatch",
    passes,
    stoppedReason: Date.now() >= input.deadlineMs ? "DURATION_LIMIT" : "PASS_LIMIT",
    lastPass: lastDispatch && lastWorker ? { dispatch: lastDispatch, worker: lastWorker } : undefined,
  };
}

async function runAutomationPass(): Promise<DailyDispatchJobResult> {
  const schedule = await automationScheduleService.dispatchDueSchedules(new Date());
  const dispatch = await workerDispatcherService.dispatchDueJobs({
    jobTypes: ["AUTOMATION_EXECUTION"],
  });
  const worker = await workerExecutorService.processAvailableJobs({
    workerId: `automation-${Date.now()}`,
    limit: 20,
  });

  const didWork = schedule.triggered > 0 || dispatch.created > 0 || worker.claimed > 0;
  return {
    jobId: "automation",
    passes: 1,
    stoppedReason: didWork ? "PASS_LIMIT" : "IDLE",
    lastPass: { schedule, dispatch, worker },
  };
}

async function runIntelligencePass(): Promise<DailyDispatchJobResult> {
  const intelligence = await backgroundIntelligenceService.runIntelligencePass();
  return {
    jobId: "intelligence",
    passes: 1,
    stoppedReason: "PASS_LIMIT",
    lastPass: { intelligence },
  };
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
      } else if (jobId === "worker_dispatch") {
        const result = await runWorkerDispatchPasses({
          maxPasses: remainingPasses,
          deadlineMs,
          workerId,
        });
        totalPasses += result.passes;
        jobs.push(result);
      } else if (jobId === "automation") {
        const result = await runAutomationPass();
        totalPasses += result.passes;
        jobs.push(result);
      } else if (jobId === "intelligence") {
        const result = await runIntelligencePass();
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
