import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { usageMeteringService } from "@/server/services/usage-metering-service";

export const USAGE_RESERVATION_TTL_MS = 15 * 60 * 1000;

export type UsageReservationMetadata = {
  reservationStatus: "active" | "committed" | "released";
  expiresAt: string;
  committedAt?: string;
  releasedAt?: string;
  operationType?: string;
};

function reservationLockKey(organisationId: string, meterKey: string): string {
  return `${organisationId}:${meterKey}`;
}

function isActiveReservation(metadata: unknown, now = Date.now()): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const record = metadata as UsageReservationMetadata;
  if (record.reservationStatus !== "active") return false;
  const expiresAt = Date.parse(record.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export async function expireStaleReservations(
  organisationId: string,
  meterKey: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const now = new Date();
  const records = await tx.usageRecord.findMany({
    where: { organisationId, meterKey },
    select: { id: true, metadata: true },
  });

  for (const record of records) {
    if (!isActiveReservation(record.metadata, now.getTime())) continue;
    const metadata = record.metadata as UsageReservationMetadata;
    if (Date.parse(metadata.expiresAt) <= now.getTime()) {
      await tx.usageRecord.update({
        where: { id: record.id },
        data: {
          amount: 0,
          metadata: {
            ...metadata,
            reservationStatus: "released",
            releasedAt: now.toISOString(),
          },
        },
      });
    }
  }
}

async function sumMeteredUsage(
  organisationId: string,
  meterKey: string,
  period: { start: Date; end: Date },
  tx: Prisma.TransactionClient,
): Promise<number> {
  const records = await tx.usageRecord.findMany({
    where: {
      organisationId,
      meterKey,
      periodStart: period.start,
      periodEnd: period.end,
    },
    select: { amount: true, metadata: true },
  });

  return records.reduce((total, record) => {
    if (record.metadata && typeof record.metadata === "object") {
      const status = (record.metadata as UsageReservationMetadata).reservationStatus;
      if (status === "released") return total;
    }
    return total + record.amount;
  }, 0);
}

export const usageReservationService = {
  async reserve(input: {
    organisationId: string;
    meterKey: string;
    amount: number;
    idempotencyKey: string;
    allowance: number;
    period?: "DAILY" | "MONTHLY" | "BILLING_PERIOD" | "LIFETIME";
    operationType?: string;
    ttlMs?: number;
  }) {
    const existing = await prisma.usageRecord.findUnique({
      where: {
        organisationId_idempotencyKey: {
          organisationId: input.organisationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      const metadata = existing.metadata as UsageReservationMetadata | null;
      return {
        reserved: metadata?.reservationStatus === "active",
        duplicate: true,
        reservationId: existing.id,
      };
    }

    const period =
      input.period === "LIFETIME"
        ? { start: new Date(0), end: new Date("2099-12-31") }
        : input.period === "BILLING_PERIOD" || !input.period
          ? await usageMeteringService.getBillingPeriod(input.organisationId)
          : usageMeteringService.resolvePeriod(input.period, input.organisationId);

    const expiresAt = new Date(Date.now() + (input.ttlMs ?? USAGE_RESERVATION_TTL_MS));

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reservationLockKey(input.organisationId, input.meterKey)}))`;
      await expireStaleReservations(input.organisationId, input.meterKey, tx);

      const currentUsage = await sumMeteredUsage(input.organisationId, input.meterKey, period, tx);
      if (currentUsage + input.amount > input.allowance) {
        throw new AppError("PLAN_LIMIT_EXCEEDED", "Plan usage limit reached.", { status: 403 });
      }

      const created = await tx.usageRecord.create({
        data: {
          workspaceId: input.organisationId,
          organisationId: input.organisationId,
          meterKey: input.meterKey,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          periodStart: period.start,
          periodEnd: period.end,
          metadata: {
            reservationStatus: "active",
            expiresAt: expiresAt.toISOString(),
            operationType: input.operationType,
          } satisfies UsageReservationMetadata,
        },
      });

      return { reserved: true, duplicate: false, reservationId: created.id };
    });
  },

  async commit(input: {
    organisationId: string;
    reservationIdempotencyKey: string;
    finalAmount?: number;
    commitIdempotencyKey?: string;
  }) {
    const reservation = await prisma.usageRecord.findUnique({
      where: {
        organisationId_idempotencyKey: {
          organisationId: input.organisationId,
          idempotencyKey: input.reservationIdempotencyKey,
        },
      },
    });
    if (!reservation) return { committed: false, reason: "not_found" as const };

    const metadata = reservation.metadata as UsageReservationMetadata | null;
    if (metadata?.reservationStatus === "committed") {
      return { committed: true, duplicate: true, reservationId: reservation.id };
    }
    if (metadata?.reservationStatus === "released") {
      return { committed: false, reason: "released" as const };
    }

    const finalAmount = input.finalAmount ?? reservation.amount;
    await prisma.usageRecord.update({
      where: { id: reservation.id },
      data: {
        amount: finalAmount,
        metadata: {
          ...metadata,
          reservationStatus: "committed",
          committedAt: new Date().toISOString(),
        },
      },
    });

    return { committed: true, duplicate: false, reservationId: reservation.id };
  },

  async release(input: { organisationId: string; reservationIdempotencyKey: string }) {
    const reservation = await prisma.usageRecord.findUnique({
      where: {
        organisationId_idempotencyKey: {
          organisationId: input.organisationId,
          idempotencyKey: input.reservationIdempotencyKey,
        },
      },
    });
    if (!reservation) return { released: false, reason: "not_found" as const };

    const metadata = reservation.metadata as UsageReservationMetadata | null;
    if (metadata?.reservationStatus === "released") {
      return { released: true, duplicate: true };
    }

    await prisma.usageRecord.update({
      where: { id: reservation.id },
      data: {
        amount: 0,
        metadata: {
          ...metadata,
          reservationStatus: "released",
          releasedAt: new Date().toISOString(),
        },
      },
    });

    return { released: true, duplicate: false };
  },

  async getReservedUsage(
    organisationId: string,
    meterKey: string,
    period: "DAILY" | "MONTHLY" | "BILLING_PERIOD" | "LIFETIME" = "BILLING_PERIOD",
  ) {
    const range =
      period === "LIFETIME"
        ? { start: new Date(0), end: new Date("2099-12-31") }
        : period === "BILLING_PERIOD"
          ? await usageMeteringService.getBillingPeriod(organisationId)
          : usageMeteringService.resolvePeriod(period, organisationId);
    return sumMeteredUsage(organisationId, meterKey, range, prisma);
  },
};
