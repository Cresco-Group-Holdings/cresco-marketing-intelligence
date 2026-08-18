import { prisma } from "@/lib/database/prisma";
import { getWorkerPlatformConfig } from "@/lib/workers/config";
import { tokenRefreshJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

function refreshWindowStart(now: Date, windowMs: number): Date {
  const bucket = Math.floor(now.getTime() / windowMs) * windowMs;
  return new Date(bucket);
}

export async function discoverTokenRefreshDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const config = getWorkerPlatformConfig();
  const threshold = new Date(now.getTime() + config.tokenRefreshWindowMs);
  const windowStart = refreshWindowStart(now, config.tokenRefreshWindowMs);
  const take = Math.min(limit, config.tokenRefreshBatchLimit);

  const connections = await prisma.providerConnection.findMany({
    where: {
      status: { in: ["CONNECTED", "RECONNECTED", "DEGRADED", "EXPIRED"] },
      tokenExpiresAt: { lte: threshold },
      organisation: { status: "ACTIVE", archivedAt: null },
    },
    orderBy: { tokenExpiresAt: "asc" },
    take,
    select: {
      id: true,
      organisationId: true,
      tokenExpiresAt: true,
    },
  });

  return connections.map((connection) => ({
    organisationId: connection.organisationId,
    jobType: "TOKEN_REFRESH",
    domainRefType: "providerConnection",
    domainRefId: connection.id,
    idempotencyKey: tokenRefreshJobIdempotencyKey(connection.id, windowStart),
    dueAt: connection.tokenExpiresAt ?? now,
    payload: { connectionId: connection.id },
    maxAttempts: 2,
  }));
}
