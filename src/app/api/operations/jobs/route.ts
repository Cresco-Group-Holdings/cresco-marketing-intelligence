import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { requireOrganisationId, withOperationsRead } from "@/lib/api/operations-handler";
import { prisma } from "@/lib/database/prisma";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";

type Params = { params: Promise<Record<string, never>> };

export async function GET(request: NextRequest, _context: Params) {
  const organisationId = requireOrganisationId(request);
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const jobType = request.nextUrl.searchParams.get("jobType") ?? undefined;
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 100);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const jobs = await prisma.workerJob.findMany({
      where: {
        organisationId,
        ...(status ? { status: status as never } : {}),
        ...(jobType ? { jobType: jobType as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        jobType: true,
        status: true,
        domainRefType: true,
        domainRefId: true,
        attemptCount: true,
        maxAttempts: true,
        safeErrorMessage: true,
        errorCategory: true,
        createdAt: true,
        dueAt: true,
        nextRetryAt: true,
        startedAt: true,
        completedAt: true,
        scheduledAt: true,
      },
    });

    const [queued, failed, retrying, oldestPending, scheduler] = await Promise.all([
      prisma.workerJob.count({
        where: { organisationId, status: { in: ["READY", "SCHEDULED", "PENDING"] } },
      }),
      prisma.workerJob.count({
        where: { organisationId, status: { in: ["FAILED", "DEAD_LETTER"] } },
      }),
      prisma.workerJob.count({ where: { organisationId, status: "RETRY_WAIT" } }),
      prisma.workerJob.findFirst({
        where: { organisationId, status: { in: ["READY", "SCHEDULED", "PENDING"] } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, dueAt: true, nextRetryAt: true },
      }),
      schedulerHealthService.getHealth(),
    ]);

    return apiSuccess(
      {
        jobs,
        health: {
          queued,
          failed,
          retrying,
          oldestPendingAt: oldestPending?.createdAt ?? null,
          oldestReadyDueAt: oldestPending?.dueAt ?? null,
          scheduler: {
            lagMs: scheduler.lagMs,
            missedHeartbeat: scheduler.missedHeartbeat,
            lastInvokedAt: scheduler.heartbeat?.lastInvokedAt ?? null,
            schedulerSlaMinutes: scheduler.schedulerSlaMinutes,
            primarySource: scheduler.primarySource,
            recentCycles: scheduler.recentCycles,
          },
        },
      },
      { requestId },
    );
  });
}

export async function POST(request: NextRequest, _context: Params) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const action = body.action as string;
  const jobId = body.jobId as string | undefined;

  if (!jobId) {
    throw new AppError("VALIDATION_ERROR", "jobId is required.");
  }

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const { workerJobService } = await import("@/server/services/worker-job-service");
    const job = await prisma.workerJob.findFirst({
      where: { id: jobId, organisationId },
    });
    if (!job) {
      throw new AppError("NOT_FOUND", "Job not found.");
    }

    if (action === "retry") {
      const updated = await workerJobService.requeueForManualRetry(jobId, organisationId);
      return apiSuccess({ job: updated }, { requestId });
    }

    if (action === "cancel") {
      const updated = await workerJobService.cancelJob(job.id, organisationId);
      return apiSuccess({ job: updated }, { requestId });
    }

    throw new AppError("VALIDATION_ERROR", `Unknown action: ${action}`);
  });
}
