import { prisma } from "@/lib/database/prisma";
import { PAID_ADS_PROVIDERS } from "@/lib/paid-ads/constants";
import type { PaidChartMetric, PaidChartPoint } from "@/components/marketing/paid-performance-chart";
import { chartGranularityForRange } from "@/lib/marketing/date-range";

type SeriesInput = {
  brandId: string;
  organisationId: string;
  from: Date;
  to: Date;
};

function bucketKey(date: Date, granularity: "hour" | "day" | "week"): string {
  if (granularity === "hour") {
    return `${date.toISOString().slice(0, 13)}:00`;
  }
  if (granularity === "week") {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return weekStart.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function formatBucketLabel(key: string, granularity: "hour" | "day" | "week"): string {
  const date = new Date(key.length === 13 ? `${key}:00.000Z` : `${key}T00:00:00.000Z`);
  if (granularity === "hour") {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

async function queryMetricSeries(
  input: SeriesInput,
  metricKeys: string[],
): Promise<Map<string, number>> {
  const observations = await prisma.marketingMetricObservation.findMany({
    where: {
      brandId: input.brandId,
      organisationId: input.organisationId,
      provider: { in: PAID_ADS_PROVIDERS },
      metricKey: { in: metricKeys },
      observedAt: { gte: input.from, lte: input.to },
    },
    select: {
      metricKey: true,
      metricValue: true,
      observedAt: true,
    },
    orderBy: { observedAt: "asc" },
    take: 5000,
  });

  const granularity = chartGranularityForRange(input.from, input.to);
  const grouped = new Map<string, number>();

  for (const row of observations) {
    const key = bucketKey(row.observedAt, granularity);
    grouped.set(key, (grouped.get(key) ?? 0) + Number(row.metricValue));
  }

  return grouped;
}

async function querySpendSeries(input: SeriesInput): Promise<Map<string, number>> {
  const costs = await prisma.marketingCostRecord.findMany({
    where: {
      brandId: input.brandId,
      organisationId: input.organisationId,
      periodStart: { gte: input.from, lte: input.to },
    },
    select: {
      amount: true,
      periodStart: true,
    },
    orderBy: { periodStart: "asc" },
    take: 5000,
  });

  const granularity = chartGranularityForRange(input.from, input.to);
  const grouped = new Map<string, number>();

  for (const row of costs) {
    const key = bucketKey(row.periodStart, granularity);
    grouped.set(key, (grouped.get(key) ?? 0) + Number(row.amount));
  }

  return grouped;
}

function mapToPoints(grouped: Map<string, number>): PaidChartPoint[] {
  const granularity = grouped.size > 0 ? "day" : "day";
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      label: formatBucketLabel(key, granularity),
      value,
    }));
}

function combineRoas(
  spend: Map<string, number>,
  revenue: Map<string, number>,
): PaidChartPoint[] {
  const keys = new Set([...spend.keys(), ...revenue.keys()]);
  return Array.from(keys)
    .sort()
    .map((key) => {
      const spendValue = spend.get(key) ?? 0;
      const revenueValue = revenue.get(key) ?? 0;
      return {
        label: formatBucketLabel(key, "day"),
        value: spendValue > 0 ? revenueValue / spendValue : 0,
      };
    });
}

function combineCpa(spend: Map<string, number>, conversions: Map<string, number>): PaidChartPoint[] {
  const keys = new Set([...spend.keys(), ...conversions.keys()]);
  return Array.from(keys)
    .sort()
    .map((key) => {
      const spendValue = spend.get(key) ?? 0;
      const conversionValue = conversions.get(key) ?? 0;
      return {
        label: formatBucketLabel(key, "day"),
        value: conversionValue > 0 ? spendValue / conversionValue : 0,
      };
    });
}

export async function buildPaidMetricSeries(
  input: SeriesInput,
): Promise<Record<PaidChartMetric, PaidChartPoint[]>> {
  const [spend, revenue, conversions] = await Promise.all([
    querySpendSeries(input),
    queryMetricSeries(input, ["conversion_value", "revenue"]),
    queryMetricSeries(input, ["conversions"]),
  ]);

  return {
    spend: mapToPoints(spend),
    revenue: mapToPoints(revenue),
    conversions: mapToPoints(conversions),
    roas: combineRoas(spend, revenue),
    cpa: combineCpa(spend, conversions),
  };
}

export async function sumPaidRevenue(
  brandId: string,
  organisationId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const result = await prisma.marketingMetricObservation.aggregate({
    where: {
      brandId,
      organisationId,
      provider: { in: PAID_ADS_PROVIDERS },
      metricKey: { in: ["conversion_value", "revenue"] },
      observedAt: { gte: from, lte: to },
    },
    _sum: { metricValue: true },
  });

  return Number(result._sum.metricValue ?? 0);
}

export async function latestPaidSyncAt(
  brandId: string,
  organisationId: string,
): Promise<Date | null> {
  const account = await prisma.connectorAccount.findFirst({
    where: {
      brandId,
      organisationId,
      connectorType: { in: ["GOOGLE_ADS", "META", "LINKEDIN", "TIKTOK"] },
      lastSuccessfulSyncAt: { not: null },
    },
    orderBy: { lastSuccessfulSyncAt: "desc" },
    select: { lastSuccessfulSyncAt: true },
  });

  return account?.lastSuccessfulSyncAt ?? null;
}

export async function latestOrganicSyncAt(
  brandId: string,
  organisationId: string,
): Promise<Date | null> {
  const connection = await prisma.socialConnection.findFirst({
    where: {
      brandId,
      organisationId,
      status: "CONNECTED",
      lastValidatedAt: { not: null },
    },
    orderBy: { lastValidatedAt: "desc" },
    select: { lastValidatedAt: true },
  });

  return connection?.lastValidatedAt ?? null;
}
