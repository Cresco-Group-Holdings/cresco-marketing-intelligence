import type { AnalyticsGranularity, Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildFactFingerprint } from "@/lib/analytics-core/deduplication";
import { normaliseDateRange } from "@/lib/analytics-core/date-boundaries";
import { toDecimal } from "@/lib/analytics-core/decimal";
import { validateImportRows } from "@/lib/analytics-core/import-validation";
import { DEFAULT_ANALYTICS_METRIC_DEFINITIONS } from "@/lib/analytics-core/metric-registry";
import {
  serializeAnalyticsFact,
  serializeAnalyticsImportBatch,
  serializeMetricTotals,
} from "@/lib/analytics-core/serialize";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type {
  AnalyticsFactQueryInput,
  AnalyticsManualImportInput,
} from "@/lib/validation/analytics-core";

function workspaceIdFor(organisationId: string) {
  return organisationId;
}

async function ensureMetricDefinitions(organisationId: string) {
  const workspaceId = workspaceIdFor(organisationId);
  const existing = await prisma.analyticsMetricDefinition.count({ where: { organisationId } });
  if (existing > 0) return;

  await prisma.analyticsMetricDefinition.createMany({
    data: DEFAULT_ANALYTICS_METRIC_DEFINITIONS.map((definition) => ({
      organisationId,
      workspaceId,
      ...definition,
    })),
    skipDuplicates: true,
  });
}

async function getOrCreateManualDataSource(organisationId: string, dataSourceId?: string) {
  if (dataSourceId) {
    const source = await prisma.analyticsDataSource.findFirst({
      where: { id: dataSourceId, organisationId },
    });
    if (!source) throw new AppError("NOT_FOUND", "Analytics data source not found.");
    return source;
  }

  const workspaceId = workspaceIdFor(organisationId);
  const existing = await prisma.analyticsDataSource.findFirst({
    where: { organisationId, kind: "MANUAL_IMPORT", status: "ACTIVE" },
  });
  if (existing) return existing;

  return prisma.analyticsDataSource.create({
    data: {
      organisationId,
      workspaceId,
      name: "Manual import",
      kind: "MANUAL_IMPORT",
      status: "ACTIVE",
    },
  });
}

function buildFactWhere(
  organisationId: string,
  filters: AnalyticsFactQueryInput,
): Prisma.AnalyticsFactWhereInput {
  const range = normaliseDateRange({ from: filters.from, to: filters.to });
  return {
    organisationId,
    occurredAt: { gte: range.from, lte: range.to },
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.granularity ? { granularity: filters.granularity as AnalyticsGranularity } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.metricKeys?.length ? { metricKey: { in: filters.metricKeys } } : {}),
  };
}

async function aggregateBaseMetrics(organisationId: string, filters: AnalyticsFactQueryInput) {
  const where = buildFactWhere(organisationId, filters);
  const groups = await prisma.analyticsFact.groupBy({
    by: ["metricKey", "currency"],
    where,
    _sum: { value: true },
    _count: { _all: true },
  });

  return groups.map((group) => ({
    metricKey: group.metricKey,
    total: group._sum.value ?? new PrismaNamespace.Decimal(0),
    currency: group.currency,
    factCount: group._count._all,
  }));
}

export const analyticsCoreService = {
  async ensureDefinitions(organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    await ensureMetricDefinitions(organisationId);
    const [metrics, dimensions, sources] = await Promise.all([
      prisma.analyticsMetricDefinition.findMany({ where: { organisationId } }),
      prisma.analyticsDimensionDefinition.findMany({ where: { organisationId } }),
      prisma.analyticsDataSource.findMany({ where: { organisationId } }),
    ]);
    return { metrics, dimensions, sources };
  },

  async queryFacts(organisationId: string, filters: AnalyticsFactQueryInput, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const where = buildFactWhere(organisationId, filters);
    const facts = await prisma.analyticsFact.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { metricKey: "asc" }],
      take: 500,
    });
    return facts.map(serializeAnalyticsFact);
  },

  async aggregateMetrics(organisationId: string, filters: AnalyticsFactQueryInput, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const rows = await aggregateBaseMetrics(organisationId, filters);
    return serializeMetricTotals(rows);
  },

  async importManualMetrics(
    organisationId: string,
    input: AnalyticsManualImportInput,
    context: TenantContext,
    actorUserId: string,
  ) {
    assertOrganisationScope(organisationId, context);
    await ensureMetricDefinitions(organisationId);

    const dataSource = await getOrCreateManualDataSource(organisationId, input.dataSourceId);
    const workspaceId = workspaceIdFor(organisationId);
    const { accepted, rejected } = validateImportRows(input.rows);

    const batch = await prisma.analyticsImportBatch.create({
      data: {
        organisationId,
        workspaceId,
        dataSourceId: dataSource.id,
        status: "VALIDATING",
        fileName: input.fileName,
        rowCount: input.rows.length,
        rejectedCount: rejected.length,
        startedAt: new Date(),
        createdByUserId: actorUserId,
        errors: rejected.length ? rejected : undefined,
      },
    });

    let acceptedCount = 0;
    let duplicateCount = 0;
    const warnings: string[] = [];

    for (const row of accepted) {
      const fingerprint = buildFactFingerprint({
        organisationId,
        projectId: row.projectId,
        brandId: row.brandId,
        campaignId: row.campaignId,
        channel: row.channel,
        provider: row.provider,
        metricKey: row.metricKey,
        occurredAt: row.occurredAt,
        granularity: row.granularity,
        currency: row.currency,
        dimensions: row.dimensions,
      });

      try {
        await prisma.analyticsFact.create({
          data: {
            organisationId,
            workspaceId,
            projectId: row.projectId,
            brandId: row.brandId,
            campaignId: row.campaignId,
            channel: row.channel,
            provider: row.provider ?? "manual",
            dataSourceId: dataSource.id,
            metricKey: row.metricKey,
            value: toDecimal(row.value),
            currency: row.currency,
            occurredAt: new Date(row.occurredAt),
            granularity: row.granularity,
            dimensions: (row.dimensions ?? {}) as Prisma.InputJsonValue,
            sourceBatchId: batch.id,
            dedupeFingerprint: fingerprint,
          },
        });
        acceptedCount += 1;
      } catch (error) {
        if (
          error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          duplicateCount += 1;
          continue;
        }
        throw error;
      }
    }

    const status =
      acceptedCount === 0 && rejected.length > 0
        ? "FAILED"
        : duplicateCount > 0 || rejected.length > 0
          ? "PARTIAL"
          : "COMPLETED";

    if (duplicateCount > 0) {
      warnings.push(`${duplicateCount} duplicate row(s) were skipped.`);
    }

    const [updatedBatch] = await Promise.all([
      prisma.analyticsImportBatch.update({
        where: { id: batch.id },
        data: {
          status,
          acceptedCount,
          duplicateCount,
          rejectedCount: rejected.length,
          warnings: warnings.length ? warnings : undefined,
          completedAt: new Date(),
        },
      }),
      prisma.analyticsDataSource.update({
        where: { id: dataSource.id },
        data: { lastImportAt: new Date() },
      }),
    ]);

    return serializeAnalyticsImportBatch(updatedBatch);
  },

  async getImportBatch(organisationId: string, batchId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const batch = await prisma.analyticsImportBatch.findFirst({
      where: { id: batchId, organisationId },
    });
    if (!batch) throw new AppError("NOT_FOUND", "Analytics import batch not found.");
    return serializeAnalyticsImportBatch(batch);
  },

  async getLastFactAt(organisationId: string, filters?: { brandId?: string; campaignId?: string }) {
    const fact = await prisma.analyticsFact.findFirst({
      where: {
        organisationId,
        ...(filters?.brandId ? { brandId: filters.brandId } : {}),
        ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
      },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    });
    return fact?.occurredAt ?? null;
  },
};
