import { prisma } from "@/lib/database/prisma";
import { providerSyncJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

export async function discoverProviderSyncDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const due = await prisma.providerSyncRun.findMany({
    where: {
      status: { in: ["QUEUED", "RETRYING"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      organisation: { status: "ACTIVE", archivedAt: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      organisationId: true,
      nextRetryAt: true,
    },
  });

  return due.map((run) => ({
    organisationId: run.organisationId,
    jobType: "PROVIDER_SYNC",
    domainRefType: "providerSyncRun",
    domainRefId: run.id,
    idempotencyKey: providerSyncJobIdempotencyKey(run.id),
    dueAt: run.nextRetryAt ?? now,
    payload: { syncRunId: run.id },
  }));
}
