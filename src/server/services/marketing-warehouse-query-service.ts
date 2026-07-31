import type { MarketingDataProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getWarehouseConfig } from "@/lib/warehouse/config";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  WarehouseEventsQueryInput,
  WarehouseMetricsQueryInput,
} from "@/lib/validation/warehouse";
import { brandService } from "@/server/services/workspace-service";

function assertDateRange(from: Date, to: Date) {
  const config = getWarehouseConfig();
  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (days > config.maxQueryDays) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Date range exceeds maximum of ${config.maxQueryDays} days.`,
    );
  }
  if (from > to) {
    throw new AppError("VALIDATION_ERROR", "From date must be before to date.");
  }
}

export const marketingWarehouseQueryService = {
  async queryMetrics(
    organisationId: string,
    filters: Omit<WarehouseMetricsQueryInput, "from" | "to"> & { from: Date; to: Date },
    context: TenantContext,
  ) {
    await brandService.getById(filters.brandId, organisationId, context);
    assertDateRange(filters.from, filters.to);

    const limit = Math.min(filters.limit, getWarehouseConfig().maxListLimit);
    const where: Prisma.MarketingMetricObservationWhereInput = {
      organisationId,
      brandId: filters.brandId,
      observedAt: { gte: filters.from, lte: filters.to },
      ...(filters.metricKey ? { metricKey: filters.metricKey } : {}),
      ...(filters.provider ? { provider: filters.provider } : {}),
    };

    const items = await prisma.marketingMetricObservation.findMany({
      where,
      orderBy: { [filters.sortBy ?? "observedAt"]: filters.sortDirection },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        marketingMetricDefinition: {
          select: { canonicalKey: true, displayName: true, unit: true },
        },
        marketingChannel: { select: { id: true, name: true } },
        marketingCampaign: { select: { id: true, name: true } },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    let grouped: Array<Record<string, unknown>> | undefined;
    if (filters.groupBy?.length) {
      const groups = new Map<string, { count: number; total: number }>();
      for (const item of page) {
        const key = filters.groupBy
          .map((field) => {
            if (field === "metricKey") return item.metricKey;
            if (field === "provider") return item.provider;
            if (field === "source") return item.source;
            if (field === "marketingChannelId") return item.marketingChannelId ?? "none";
            if (field === "marketingCampaignId") return item.marketingCampaignId ?? "none";
            if (field === "marketingAccountId") return item.marketingAccountId ?? "none";
            if (field === "periodGrain") return item.periodGrain ?? "none";
            return "unknown";
          })
          .join("|");
        const current = groups.get(key) ?? { count: 0, total: 0 };
        current.count += 1;
        current.total += Number(item.metricValue);
        groups.set(key, current);
      }
      grouped = [...groups.entries()].map(([key, value]) => ({
        key,
        count: value.count,
        total: value.total,
      }));
    }

    return {
      items: page,
      grouped,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    };
  },

  async queryEvents(
    organisationId: string,
    filters: Omit<WarehouseEventsQueryInput, "from" | "to"> & { from: Date; to: Date },
    context: TenantContext,
  ) {
    await brandService.getById(filters.brandId, organisationId, context);
    assertDateRange(filters.from, filters.to);

    const limit = Math.min(filters.limit, getWarehouseConfig().maxListLimit);
    const where: Prisma.MarketingEventWhereInput = {
      organisationId,
      brandId: filters.brandId,
      occurredAt: { gte: filters.from, lte: filters.to },
      ...(filters.eventName ? { eventName: filters.eventName } : {}),
      ...(filters.provider ? { provider: filters.provider } : {}),
    };

    const items = await prisma.marketingEvent.findMany({
      where,
      orderBy: { [filters.sortBy ?? "occurredAt"]: filters.sortDirection },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        provider: true,
        source: true,
        providerEventId: true,
        eventName: true,
        occurredAt: true,
        marketingCampaignId: true,
        properties: true,
        createdAt: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    };
  },

  async queryRevenue(
    organisationId: string,
    filters: { brandId: string; from: Date; to: Date; cursor?: string; limit: number },
    context: TenantContext,
  ) {
    await brandService.getById(filters.brandId, organisationId, context);
    assertDateRange(filters.from, filters.to);
    const limit = Math.min(filters.limit, getWarehouseConfig().maxListLimit);

    const items = await prisma.marketingRevenueRecord.findMany({
      where: {
        organisationId,
        brandId: filters.brandId,
        recognisedAt: { gte: filters.from, lte: filters.to },
      },
      orderBy: { recognisedAt: "desc" },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },

  async queryCosts(
    organisationId: string,
    filters: {
      brandId: string;
      from: Date;
      to: Date;
      cursor?: string;
      limit: number;
      marketingCampaignId?: string;
    },
    context: TenantContext,
  ) {
    await brandService.getById(filters.brandId, organisationId, context);
    assertDateRange(filters.from, filters.to);
    const limit = Math.min(filters.limit, getWarehouseConfig().maxListLimit);

    const items = await prisma.marketingCostRecord.findMany({
      where: {
        organisationId,
        brandId: filters.brandId,
        periodStart: { gte: filters.from },
        periodEnd: { lte: filters.to },
        ...(filters.marketingCampaignId ? { marketingCampaignId: filters.marketingCampaignId } : {}),
      },
      orderBy: { periodStart: "desc" },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        marketingCampaign: { select: { id: true, name: true } },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },

  async listConversions(
    organisationId: string,
    filters: { brandId: string; provider?: string; activeOnly?: boolean; cursor?: string; limit: number },
    context: TenantContext,
  ) {
    await brandService.getById(filters.brandId, organisationId, context);
    const limit = Math.min(filters.limit, getWarehouseConfig().maxListLimit);

    const items = await prisma.marketingConversionDefinition.findMany({
      where: {
        organisationId,
        brandId: filters.brandId,
        ...(filters.provider ? { provider: filters.provider as MarketingDataProvider } : {}),
        ...(filters.activeOnly ? { isActive: true } : {}),
      },
      orderBy: { displayName: "asc" },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },
};
