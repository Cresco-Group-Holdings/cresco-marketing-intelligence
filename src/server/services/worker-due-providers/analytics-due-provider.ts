import { prisma } from "@/lib/database/prisma";
import { getAnalyticsSyncConfig } from "@/lib/analytics/config";
import { analyticsSyncJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

export async function discoverAnalyticsDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const config = getAnalyticsSyncConfig();
  if (!config.schedulerEnabled) return [];

  const due = await prisma.socialAnalyticsSync.findMany({
    where: {
      OR: [
        {
          status: { in: ["QUEUED", "PARTIAL"] },
          AND: [
            { OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
            { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
          ],
        },
        { status: "RUNNING", leaseExpiresAt: { lt: now } },
      ],
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      organisationId: true,
      scheduledFor: true,
    },
  });

  return due.map((sync) => ({
    organisationId: sync.organisationId,
    jobType: "ANALYTICS_SYNC",
    domainRefType: "socialAnalyticsSync",
    domainRefId: sync.id,
    idempotencyKey: analyticsSyncJobIdempotencyKey(sync.id),
    dueAt: sync.scheduledFor ?? now,
    payload: { syncId: sync.id },
  }));
}
