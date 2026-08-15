import type { AnalyticsFact, AnalyticsImportBatch, Prisma } from "@prisma/client";
import { decimalToNumber } from "@/lib/analytics-core/decimal";

export function serializeAnalyticsFact(fact: AnalyticsFact) {
  return {
    id: fact.id,
    workspaceId: fact.workspaceId,
    organisationId: fact.organisationId,
    projectId: fact.projectId,
    brandId: fact.brandId,
    campaignId: fact.campaignId,
    channel: fact.channel,
    provider: fact.provider,
    metricKey: fact.metricKey,
    value: decimalToNumber(fact.value),
    currency: fact.currency,
    occurredAt: fact.occurredAt.toISOString(),
    granularity: fact.granularity,
    dimensions: fact.dimensions as Record<string, unknown>,
    sourceBatchId: fact.sourceBatchId,
    dataSourceId: fact.dataSourceId,
    createdAt: fact.createdAt.toISOString(),
  };
}

export function serializeAnalyticsImportBatch(batch: AnalyticsImportBatch) {
  return {
    id: batch.id,
    workspaceId: batch.workspaceId,
    organisationId: batch.organisationId,
    dataSourceId: batch.dataSourceId,
    status: batch.status,
    fileName: batch.fileName,
    rowCount: batch.rowCount,
    acceptedCount: batch.acceptedCount,
    rejectedCount: batch.rejectedCount,
    duplicateCount: batch.duplicateCount,
    errors: batch.errors,
    warnings: batch.warnings,
    startedAt: batch.startedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
  };
}

export type AggregatedFactRow = {
  metricKey: string;
  total: Prisma.Decimal;
  currency: string | null;
  factCount: number;
};

export function serializeMetricTotals(rows: AggregatedFactRow[]) {
  const totals: Record<string, number> = {};
  const currencies: Record<string, string | null> = {};
  for (const row of rows) {
    totals[row.metricKey] = Number(row.total.toString());
    currencies[row.metricKey] = row.currency;
  }
  return { totals, currencies };
}
