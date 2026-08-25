import { prisma } from "@/lib/database/prisma";
import { billingAccountService } from "@/server/services/billing-account-service";
import { usageReservationService } from "@/lib/billing/usage-reservation";

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export const usageMeteringService = {
  resolvePeriod(period: "DAILY" | "MONTHLY" | "BILLING_PERIOD" | "LIFETIME", organisationId: string) {
    if (period === "DAILY") {
      const start = startOfUtcDay();
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      return { start, end };
    }
    if (period === "LIFETIME") {
      return { start: new Date(0), end: new Date("2099-12-31") };
    }
    if (period === "BILLING_PERIOD") {
      // resolved from subscription below
    }
    const start = startOfUtcMonth();
    const end = endOfUtcMonth();
    return { start, end };
  },

  async getBillingPeriod(organisationId: string) {
    const account = await billingAccountService.getAccount(organisationId);
    const sub = account.subscription;
    if (!sub) {
      const start = startOfUtcMonth();
      return { start, end: endOfUtcMonth() };
    }
    return { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
  },

  async recordUsage(input: {
    organisationId: string;
    meterKey: string;
    amount: number;
    idempotencyKey: string;
    period?: "DAILY" | "MONTHLY" | "BILLING_PERIOD" | "LIFETIME";
    metadata?: Record<string, unknown>;
  }) {
    const existing = await prisma.usageRecord.findUnique({
      where: {
        organisationId_idempotencyKey: {
          organisationId: input.organisationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { recorded: false, duplicate: true };

    const period =
      input.period === "LIFETIME"
        ? { start: new Date(0), end: new Date("2099-12-31") }
        : input.period === "BILLING_PERIOD" || !input.period
          ? await this.getBillingPeriod(input.organisationId)
          : this.resolvePeriod(input.period, input.organisationId);

    await prisma.usageRecord.create({
      data: {
        workspaceId: input.organisationId,
        organisationId: input.organisationId,
        meterKey: input.meterKey,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
        periodStart: period.start,
        periodEnd: period.end,
        metadata: input.metadata as object | undefined,
      },
    });

    return { recorded: true, duplicate: false };
  },

  async getUsage(organisationId: string, meterKey: string, period?: "DAILY" | "MONTHLY" | "BILLING_PERIOD" | "LIFETIME") {
    const range =
      period === "LIFETIME"
        ? { start: new Date(0), end: new Date("2099-12-31") }
        : period === "BILLING_PERIOD" || !period
          ? await this.getBillingPeriod(organisationId)
          : this.resolvePeriod(period, organisationId);

    const total = await usageReservationService.getReservedUsage(
      organisationId,
      meterKey,
      period ?? "BILLING_PERIOD",
    );

    return {
      meterKey,
      total,
      periodStart: range.start.toISOString(),
      periodEnd: range.end.toISOString(),
    };
  },

  async getUsageOverview(organisationId: string) {
    const account = await billingAccountService.getAccount(organisationId);
    const allowances = await prisma.usageAllowance.findMany({
      where: { planVersionId: account.subscription!.planVersionId },
      include: { meter: true },
    });

    const usage = await Promise.all(
      allowances.map(async (allowance) => {
        const used = await this.getUsage(organisationId, allowance.meterKey, allowance.period);
        return {
          meterKey: allowance.meterKey,
          displayName: allowance.meter.displayName,
          unit: allowance.meter.unit,
          allowance: allowance.allowance,
          used: used.total,
          remaining: Math.max(0, allowance.allowance - used.total),
          period: allowance.period,
        };
      }),
    );

    return usage;
  },
};
