import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  type Ga4SyncItem,
  ga4AnalyticsAdapter,
} from "@/lib/connectors/adapters/ga4-analytics-adapter";
import {
  GA4_DEFAULT_BACKFILL_DAYS,
  GA4_RECONCILIATION_DAYS,
  GA4_TRANSFORMATION_VERSION,
} from "@/lib/ga4/constants";
import { GA4_QUERY_DEFINITIONS } from "@/lib/ga4/query-registry";
import type { Ga4ConnectorMetadata } from "@/lib/ga4/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { connectorSyncService } from "@/server/services/connector-sync-service";
import { marketingWarehouseIngestionService } from "@/server/services/marketing-warehouse-ingestion-service";
import { marketingWarehouseNormalisationService } from "@/server/services/marketing-warehouse-normalisation-service";
import { ga4ConnectionService } from "@/server/services/ga4-connection-service";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseMetadata(value: unknown): Ga4ConnectorMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Ga4ConnectorMetadata;
}

function dateRangeForSync(
  syncType: "INITIAL" | "INCREMENTAL",
  metadata: Ga4ConnectorMetadata,
): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const endDate = formatDate(end);

  if (syncType === "INITIAL" && !metadata.syncState?.initialBackfillComplete) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (GA4_DEFAULT_BACKFILL_DAYS - 1));
    return { startDate: formatDate(start), endDate };
  }

  const reconcileStart = new Date(end);
  reconcileStart.setUTCDate(reconcileStart.getUTCDate() - (GA4_RECONCILIATION_DAYS - 1));
  return { startDate: formatDate(reconcileStart), endDate };
}

export const ga4SyncService = {
  async getSyncStatus(brandId: string, organisationId: string, context: TenantContext) {
    const account = await ga4ConnectionService.requireConnectorAccount(
      brandId,
      organisationId,
      context,
    );
    const metadata = parseMetadata(account.metadata);
    const latestSync = await prisma.connectorSync.findFirst({
      where: { connectorAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });
    const warehouseAccount = await prisma.marketingDataSourceAccount.findFirst({
      where: { connectorAccountId: account.id, brandId },
    });

    return {
      propertyId: account.externalAccountId,
      propertyName: account.externalAccountLabel,
      timezone: metadata.timeZone ?? warehouseAccount?.timezone ?? null,
      currency: metadata.currencyCode ?? warehouseAccount?.currency ?? null,
      lastSyncedDate: metadata.syncState?.lastSyncedDate ?? null,
      backfillStartDate: metadata.syncState?.backfillStartDate ?? null,
      initialBackfillComplete: metadata.syncState?.initialBackfillComplete ?? false,
      lastQuota: metadata.lastQuota ?? null,
      latestSync: latestSync
        ? {
            id: latestSync.id,
            status: latestSync.status,
            syncType: latestSync.syncType,
            recordsProcessed: latestSync.recordsProcessed,
            startedAt: latestSync.startedAt?.toISOString() ?? null,
            completedAt: latestSync.completedAt?.toISOString() ?? null,
            errorMessage: latestSync.errorMessage,
          }
        : null,
      reportDefinitions: GA4_QUERY_DEFINITIONS.map((def) => ({
        key: def.key,
        displayName: def.displayName,
      })),
    };
  },

  async startSync(
    brandId: string,
    organisationId: string,
    syncType: "INITIAL" | "INCREMENTAL",
    context: TenantContext,
    requestId?: string,
  ) {
    const account = await ga4ConnectionService.requireConnectorAccount(
      brandId,
      organisationId,
      context,
    );
    if (!account.externalAccountId) {
      throw new AppError("VALIDATION_ERROR", "Select a GA4 property before syncing.");
    }

    const metadata = parseMetadata(account.metadata);
    const range = dateRangeForSync(syncType, metadata);
    const idempotencyKey = `ga4:${account.id}:${syncType}:${range.endDate}`;

    const sync = await connectorSyncService.startSync({
      organisationId,
      projectId: account.projectId,
      brandId,
      connectorAccountId: account.id,
      connectorType: "GOOGLE_ANALYTICS_4",
      syncType,
      idempotencyKey,
    });

    if (sync.status === "COMPLETED" || sync.status === "PARTIAL") {
      await this.ingestSyncResults(
        account.id,
        sync.id,
        range,
        syncType === "INITIAL" ? "BACKFILL" : "SCHEDULED",
        context,
        requestId,
      );
    }

    return sync;
  },

  async ingestSyncResults(
    connectorAccountId: string,
    syncId: string,
    range: { startDate: string; endDate: string },
    batchSyncType: "BACKFILL" | "SCHEDULED",
    context: TenantContext,
    requestId?: string,
  ) {
    const account = await prisma.connectorAccount.findUnique({
      where: { id: connectorAccountId },
      include: { marketingDataSourceAccounts: { take: 1 } },
    });
    if (!account?.externalAccountId) return;

    const warehouseAccount = account.marketingDataSourceAccounts[0];
    if (!warehouseAccount) return;

    const items: Ga4SyncItem[] = [];
    for (const definition of GA4_QUERY_DEFINITIONS) {
      const tokens = await connectorCredentialService.readTokens(account.id);
      if (!tokens?.accessToken) break;

      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const report = await ga4AnalyticsAdapter.retrieveReport(
          tokens.accessToken,
          account.externalAccountId,
          definition.key,
          range.startDate,
          range.endDate,
          offset,
        );
        items.push({
          reportKey: definition.key,
          startDate: range.startDate,
          endDate: range.endDate,
          rows: report.rows,
          propertyQuota: report.propertyQuota,
        });
        hasMore = report.rows.length > 0 && report.rowCount > offset + report.rows.length;
        offset += report.rows.length;
        if (report.rows.length === 0) hasMore = false;
      }
    }

    const batchIdempotencyKey = `ga4-batch:${account.id}:${syncId}`;
    const records = items.flatMap((item) =>
      item.rows.map((row, index) => ({
        providerRecordId: `${item.reportKey}:${row.date ?? "unknown"}:${index}:${JSON.stringify(row).slice(0, 64)}`,
        recordType: "ga4_report_row",
        eventTime: row.date ? `${row.date}T00:00:00.000Z` : new Date().toISOString(),
        payload: {
          ...row,
          reportKey: item.reportKey,
          propertyId: account.externalAccountId,
          transformationVersion: GA4_TRANSFORMATION_VERSION,
          startDate: item.startDate,
          endDate: item.endDate,
        },
        metadata: {
          source: "GA4",
          reportKey: item.reportKey,
          propertyQuota: item.propertyQuota,
        },
      })),
    );

    if (records.length === 0) return null;

    const batch = await marketingWarehouseIngestionService.createBatch(
      {
        brandId: account.brandId,
        organisationId: account.organisationId,
        marketingDataSourceAccountId: warehouseAccount.id,
        provider: "GA4",
        syncType: batchSyncType,
        idempotencyKey: batchIdempotencyKey,
        records,
      },
      context,
      requestId,
    );

    await marketingWarehouseNormalisationService.normaliseBatch(batch.id, context, requestId);

    const metadata = parseMetadata(account.metadata);
    const updatedMetadata: Ga4ConnectorMetadata = {
      ...metadata,
      syncState: {
        ...metadata.syncState,
        backfillStartDate: metadata.syncState?.backfillStartDate ?? range.startDate,
        lastSyncedDate: range.endDate,
        lastReconciliationAt: new Date().toISOString(),
        initialBackfillComplete: true,
      },
      lastQuota: items.find((item) => item.propertyQuota)?.propertyQuota,
    };

    await prisma.connectorAccount.update({
      where: { id: account.id },
      data: { metadata: updatedMetadata as Prisma.InputJsonValue },
    });

    await prisma.marketingDataSourceAccount.update({
      where: { id: warehouseAccount.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "COMPLETED",
      },
    });

    return batch;
  },
};
