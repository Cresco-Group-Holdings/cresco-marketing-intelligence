import type { ConnectorType, MarketingDataProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getPaidAdsAdapter } from "@/lib/connectors/adapters/paid-ads-reporting-adapters";
import {
  CONNECTOR_TO_PROVIDER,
  PAID_ADS_DATA_DELAY_DAYS,
  PAID_ADS_DEFAULT_BACKFILL_DAYS,
  PAID_ADS_RECONCILIATION_DAYS,
  PAID_ADS_TRANSFORMATION_VERSION,
} from "@/lib/paid-ads/constants";
import type { PaidAdsConnectorMetadata } from "@/lib/paid-ads/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { connectorSyncService } from "@/server/services/connector-sync-service";
import { marketingWarehouseIngestionService } from "@/server/services/marketing-warehouse-ingestion-service";
import { marketingWarehouseNormalisationService } from "@/server/services/marketing-warehouse-normalisation-service";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseMetadata(value: unknown): PaidAdsConnectorMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PaidAdsConnectorMetadata;
}

function dateRangeForSync(syncType: "INITIAL" | "INCREMENTAL", metadata: PaidAdsConnectorMetadata) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - PAID_ADS_DATA_DELAY_DAYS);
  const endDate = formatDate(end);

  if (syncType === "INITIAL" && !metadata.syncState?.initialBackfillComplete) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (PAID_ADS_DEFAULT_BACKFILL_DAYS - 1));
    return { startDate: formatDate(start), endDate };
  }

  const reconcileStart = new Date(end);
  reconcileStart.setUTCDate(reconcileStart.getUTCDate() - (PAID_ADS_RECONCILIATION_DAYS - 1));
  return { startDate: formatDate(reconcileStart), endDate };
}

export const paidAdsSyncService = {
  async getSyncStatus(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
  ) {
    const account = await paidAdsConnectionService.requireConnectorAccount(
      brandId,
      organisationId,
      connectorType,
      context,
    );
    const metadata = parseMetadata(account.metadata);
    const latestSync = await prisma.connectorSync.findFirst({
      where: { connectorAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });

    return {
      adAccountId: account.externalAccountId,
      currency: metadata.currency,
      timezone: metadata.timezone,
      attributionWindow: metadata.attributionWindow,
      lastSyncedDate: metadata.syncState?.lastSyncedDate ?? null,
      backfillStartDate: metadata.syncState?.backfillStartDate ?? null,
      initialBackfillComplete: metadata.syncState?.initialBackfillComplete ?? false,
      dataDelayDays: PAID_ADS_DATA_DELAY_DAYS,
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
    };
  },

  async startSync(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    syncType: "INITIAL" | "INCREMENTAL",
    context: TenantContext,
    requestId?: string,
  ) {
    const account = await paidAdsConnectionService.requireConnectorAccount(
      brandId,
      organisationId,
      connectorType,
      context,
    );
    if (!account.externalAccountId) {
      throw new AppError("VALIDATION_ERROR", "Select an ad account before syncing.");
    }

    const provider = CONNECTOR_TO_PROVIDER[connectorType];
    if (!provider) throw new AppError("VALIDATION_ERROR", "Invalid paid ads connector.");

    const metadata = parseMetadata(account.metadata);
    const range = dateRangeForSync(syncType, metadata);
    const idempotencyKey = `paid-ads:${account.id}:${syncType}:${range.endDate}`;

    const sync = await connectorSyncService.startSync({
      organisationId,
      projectId: account.projectId,
      brandId,
      connectorAccountId: account.id,
      connectorType,
      syncType,
      idempotencyKey,
    });

    if (sync.status === "COMPLETED" || sync.status === "PARTIAL") {
      await this.ingestSyncResults(
        account.id,
        connectorType,
        provider,
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
    connectorType: ConnectorType,
    provider: MarketingDataProvider,
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
    if (!account?.externalAccountId) return null;

    const warehouseAccount = account.marketingDataSourceAccounts[0];
    if (!warehouseAccount) return null;

    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) return null;

    const adapter = getPaidAdsAdapter(provider as "GOOGLE_ADS" | "META" | "LINKEDIN" | "TIKTOK");
    const records: Array<{
      providerRecordId: string;
      recordType: string;
      eventTime?: string;
      payload: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }> = [];

    const campaigns = await adapter.getCampaigns(tokens.accessToken, account.externalAccountId);
    for (const campaign of campaigns) {
      records.push({
        providerRecordId: `campaign:${campaign.campaignId}`,
        recordType: "paid_ads_campaign",
        payload: { ...campaign, transformationVersion: PAID_ADS_TRANSFORMATION_VERSION },
        metadata: { source: provider, grain: "campaign" },
      });
    }

    const { rows: metrics } = await adapter.getMetrics(
      tokens.accessToken,
      account.externalAccountId,
      range.startDate,
      range.endDate,
    );
    for (const [index, row] of metrics.entries()) {
      records.push({
        providerRecordId: `metrics:${row.date}:${index}`,
        recordType: "paid_ads_metrics_row",
        eventTime: `${row.date}T00:00:00.000Z`,
        payload: {
          ...row,
          transformationVersion: PAID_ADS_TRANSFORMATION_VERSION,
          startDate: range.startDate,
          endDate: range.endDate,
        },
        metadata: { source: provider, reportKey: "daily_metrics" },
      });
    }

    const { rows: spend } = await adapter.getSpend(
      tokens.accessToken,
      account.externalAccountId,
      range.startDate,
      range.endDate,
    );
    for (const [index, row] of spend.entries()) {
      records.push({
        providerRecordId: `spend:${row.date}:${index}`,
        recordType: "paid_ads_spend_row",
        eventTime: `${row.date}T00:00:00.000Z`,
        payload: {
          ...row,
          currency: row.currency ?? parseMetadata(account.metadata).currency,
          transformationVersion: PAID_ADS_TRANSFORMATION_VERSION,
        },
        metadata: { source: provider },
      });
    }

    if (records.length === 0) return null;

    const batch = await marketingWarehouseIngestionService.createBatch(
      {
        brandId: account.brandId,
        organisationId: account.organisationId,
        marketingDataSourceAccountId: warehouseAccount.id,
        provider,
        syncType: batchSyncType,
        idempotencyKey: `paid-ads-batch:${account.id}:${syncId}`,
        records,
      },
      context,
      requestId,
    );

    await marketingWarehouseNormalisationService.normaliseBatch(batch.id, context, requestId);

    const metadata = parseMetadata(account.metadata);
    await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        metadata: {
          ...metadata,
          syncState: {
            ...metadata.syncState,
            backfillStartDate: metadata.syncState?.backfillStartDate ?? range.startDate,
            lastSyncedDate: range.endDate,
            lastReconciliationAt: new Date().toISOString(),
            initialBackfillComplete: true,
          },
        } as Prisma.InputJsonValue,
        lastSuccessfulSyncAt: new Date(),
      },
    });

    await prisma.marketingDataSourceAccount.update({
      where: { id: warehouseAccount.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: "COMPLETED" },
    });

    return batch;
  },
};
