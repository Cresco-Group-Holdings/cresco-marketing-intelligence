import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import type { TenantContext } from "@/lib/tenancy/context";
import type { WarehouseAggregateRefreshInput } from "@/lib/validation/warehouse";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export const marketingWarehouseAggregateService = {
  async refreshDailyAggregates(
    organisationId: string,
    input: Omit<WarehouseAggregateRefreshInput, "from" | "to"> & { from: Date; to: Date },
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(input.brandId, organisationId, context);

    const existing = await prisma.aggregateRefreshRun.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const run = await prisma.aggregateRefreshRun.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId: input.brandId,
        status: "RUNNING",
        idempotencyKey: input.idempotencyKey,
        aggregateFrom: startOfDay(input.from),
        aggregateTo: startOfDay(input.to),
        startedAt: new Date(),
      },
    });

    const observations = await prisma.marketingMetricObservation.findMany({
      where: {
        organisationId,
        brandId: input.brandId,
        observedAt: { gte: input.from, lte: input.to },
        ...(input.metricKeys?.length ? { metricKey: { in: input.metricKeys } } : {}),
      },
    });

    const buckets = new Map<string, { total: number; count: number; metricKey: string; date: Date }>();
    for (const observation of observations) {
      const date = startOfDay(observation.observedAt);
      const key = `${observation.metricKey}:${date.toISOString()}`;
      const current = buckets.get(key) ?? {
        total: 0,
        count: 0,
        metricKey: observation.metricKey,
        date,
      };
      current.total += Number(observation.metricValue);
      current.count += 1;
      buckets.set(key, current);
    }

    let metricsRefreshed = 0;
    for (const bucket of buckets.values()) {
      const definition = await prisma.marketingMetricDefinition.findFirst({
        where: { brandId: input.brandId, canonicalKey: bucket.metricKey },
      });

      const existing = await prisma.dailyMarketingAggregate.findFirst({
        where: {
          brandId: input.brandId,
          metricKey: bucket.metricKey,
          aggregateDate: bucket.date,
          dimensionKey: null,
          dimensionValue: null,
        },
      });

      if (existing) {
        await prisma.dailyMarketingAggregate.update({
          where: { id: existing.id },
          data: {
            value: bucket.total,
            sampleCount: bucket.count,
            computedAt: new Date(),
          },
        });
      } else {
        await prisma.dailyMarketingAggregate.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId: input.brandId,
            marketingMetricDefinitionId: definition?.id,
            metricKey: bucket.metricKey,
            aggregateDate: bucket.date,
            value: bucket.total,
            sampleCount: bucket.count,
          },
        });
      }
      metricsRefreshed += 1;
    }

    const completed = await prisma.aggregateRefreshRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        metricsRefreshed,
        completedAt: new Date(),
      },
    });

    incrementWarehouseCounter("warehouse.aggregates_refreshed", metricsRefreshed);

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.aggregates.refreshed",
      resourceType: "AggregateRefreshRun",
      resourceId: run.id,
      requestId,
      metadata: { metricsRefreshed },
    });

    return completed;
  },

  async listAggregates(
    organisationId: string,
    filters: {
      brandId: string;
      from: Date;
      to: Date;
      metricKey?: string;
      cursor?: string;
      limit: number;
    },
    context: TenantContext,
  ) {
    await brandService.getById(filters.brandId, organisationId, context);

    const items = await prisma.dailyMarketingAggregate.findMany({
      where: {
        organisationId,
        brandId: filters.brandId,
        aggregateDate: { gte: filters.from, lte: filters.to },
        ...(filters.metricKey ? { metricKey: filters.metricKey } : {}),
      },
      orderBy: [{ aggregateDate: "desc" }, { metricKey: "asc" }],
      take: filters.limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        marketingMetricDefinition: {
          select: { displayName: true, unit: true },
        },
      },
    });

    const hasMore = items.length > filters.limit;
    const page = hasMore ? items.slice(0, filters.limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },
};
