import { SeoCrawlRunStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { seoCrawlJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

export async function discoverSeoCrawlDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const due = await prisma.seoCrawlRun.findMany({
    where: {
      OR: [
        {
          status: { in: [SeoCrawlRunStatus.QUEUED, SeoCrawlRunStatus.PARTIAL] },
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        { status: SeoCrawlRunStatus.RUNNING, leaseExpiresAt: { lt: now } },
      ],
      organisation: { status: "ACTIVE", archivedAt: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      organisationId: true,
      createdAt: true,
    },
  });

  return due.map((run) => ({
    organisationId: run.organisationId,
    jobType: "SEO_CRAWL",
    domainRefType: "seoCrawlRun",
    domainRefId: run.id,
    idempotencyKey: seoCrawlJobIdempotencyKey(run.id),
    dueAt: now,
    payload: { runId: run.id },
  }));
}
