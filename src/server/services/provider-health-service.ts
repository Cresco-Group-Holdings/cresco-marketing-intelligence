import { prisma } from "@/lib/database/prisma";
import type { ProviderHealthStatus } from "@prisma/client";

export const providerHealthService = {
  async upsertHealth(input: {
    organisationId: string;
    connectionId: string;
    status: ProviderHealthStatus;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    success?: boolean;
  }) {
    const existing = await prisma.providerHealthState.findUnique({
      where: { connectionId: input.connectionId },
    });

    const consecutiveFailures = input.success
      ? 0
      : (existing?.consecutiveFailures ?? 0) + 1;

    return prisma.providerHealthState.upsert({
      where: { connectionId: input.connectionId },
      create: {
        organisationId: input.organisationId,
        connectionId: input.connectionId,
        status: input.status,
        lastCheckedAt: new Date(),
        lastHealthyAt: input.success ? new Date() : undefined,
        consecutiveFailures,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: input.metadata as object | undefined,
      },
      update: {
        status: input.status,
        lastCheckedAt: new Date(),
        lastHealthyAt: input.success ? new Date() : existing?.lastHealthyAt,
        consecutiveFailures,
        circuitState: consecutiveFailures >= 5 ? "OPEN" : "CLOSED",
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: input.metadata as object | undefined,
      },
    });
  },

  async recordRateLimit(input: {
    organisationId: string;
    connectionId: string;
    windowKey: string;
    retryAfterMs?: number;
  }) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + (input.retryAfterMs ?? 60_000));

    return prisma.providerRateLimitState.upsert({
      where: {
        connectionId_windowKey: {
          connectionId: input.connectionId,
          windowKey: input.windowKey,
        },
      },
      create: {
        organisationId: input.organisationId,
        connectionId: input.connectionId,
        windowKey: input.windowKey,
        requestCount: 1,
        windowStart: now,
        windowEnd,
        limitReachedAt: now,
        metadata: { retryAfterMs: input.retryAfterMs },
      },
      update: {
        requestCount: { increment: 1 },
        limitReachedAt: now,
        windowEnd,
        metadata: { retryAfterMs: input.retryAfterMs },
      },
    });
  },
};
