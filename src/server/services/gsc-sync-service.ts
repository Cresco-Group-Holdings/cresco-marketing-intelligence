import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  gscSearchConsoleAdapter,
  rowToPayload,
} from "@/lib/connectors/adapters/gsc-search-console-adapter";
import { GSC_DEFAULT_BACKFILL_DAYS, GSC_DATA_DELAY_DAYS, GSC_RECONCILIATION_DAYS, GSC_TRANSFORMATION_VERSION } from "@/lib/gsc/constants";
import { GSC_QUERY_DEFINITIONS } from "@/lib/gsc/query-registry";
import type { GscConnectorMetadata } from "@/lib/gsc/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { connectorSyncService } from "@/server/services/connector-sync-service";
import { marketingWarehouseIngestionService } from "@/server/services/marketing-warehouse-ingestion-service";
import { marketingWarehouseNormalisationService } from "@/server/services/marketing-warehouse-normalisation-service";
import { gscConnectionService } from "@/server/services/gsc-connection-service";
import { gscApiClient } from "@/lib/gsc/client";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseMetadata(value: unknown): GscConnectorMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GscConnectorMetadata;
}

function dateRangeForSync(syncType: "INITIAL" | "INCREMENTAL", metadata: GscConnectorMetadata) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - GSC_DATA_DELAY_DAYS);
  const endDate = formatDate(end);

  if (syncType === "INITIAL" && !metadata.syncState?.initialBackfillComplete) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (GSC_DEFAULT_BACKFILL_DAYS - 1));
    return { startDate: formatDate(start), endDate };
  }

  const reconcileStart = new Date(end);
  reconcileStart.setUTCDate(reconcileStart.getUTCDate() - (GSC_RECONCILIATION_DAYS - 1));
  return { startDate: formatDate(reconcileStart), endDate };
}

export const gscSyncService = {
  async getSyncStatus(brandId: string, organisationId: string, context: TenantContext) {
    const account = await gscConnectionService.requireConnectorAccount(brandId, organisationId, context);
    const metadata = parseMetadata(account.metadata);
    const latestSync = await prisma.connectorSync.findFirst({
      where: { connectorAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });

    return {
      siteUrl: account.externalAccountId,
      lastSyncedDate: metadata.syncState?.lastSyncedDate ?? null,
      backfillStartDate: metadata.syncState?.backfillStartDate ?? null,
      initialBackfillComplete: metadata.syncState?.initialBackfillComplete ?? false,
      dataDelayDays: GSC_DATA_DELAY_DAYS,
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
      reportDefinitions: GSC_QUERY_DEFINITIONS.map((def) => ({ key: def.key, displayName: def.displayName })),
    };
  },

  async startSync(
    brandId: string,
    organisationId: string,
    syncType: "INITIAL" | "INCREMENTAL",
    context: TenantContext,
    requestId?: string,
  ) {
    const account = await gscConnectionService.requireConnectorAccount(brandId, organisationId, context);
    if (!account.externalAccountId) {
      throw new AppError("VALIDATION_ERROR", "Select a Search Console property before syncing.");
    }

    const metadata = parseMetadata(account.metadata);
    const range = dateRangeForSync(syncType, metadata);
    const idempotencyKey = `gsc:${account.id}:${syncType}:${range.endDate}`;

    const sync = await connectorSyncService.startSync({
      organisationId,
      projectId: account.projectId,
      brandId,
      connectorAccountId: account.id,
      connectorType: "GOOGLE_SEARCH_CONSOLE",
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
      await this.refreshSitemaps(account.id, account.externalAccountId, context);
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
    if (!account?.externalAccountId) return null;

    const warehouseAccount = account.marketingDataSourceAccounts[0];
    if (!warehouseAccount) return null;

    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) return null;

    const records = [];
    for (const definition of GSC_QUERY_DEFINITIONS) {
      let startRow = 0;
      let hasMore = true;
      while (hasMore) {
        const result = await gscApiClient.querySearchAnalytics(
          tokens.accessToken,
          account.externalAccountId,
          definition,
          range.startDate,
          range.endDate,
          startRow,
        );
        for (const [index, row] of result.rows.entries()) {
          const payload = rowToPayload(definition.key, definition.grain, definition.dimensions, row, account.externalAccountId);
          records.push({
            providerRecordId: `${definition.key}:${payload.date}:${startRow + index}:${JSON.stringify(row.keys).slice(0, 48)}`,
            recordType: "gsc_search_analytics_row",
            eventTime: `${payload.date}T00:00:00.000Z`,
            payload: {
              ...payload,
              transformationVersion: GSC_TRANSFORMATION_VERSION,
              startDate: range.startDate,
              endDate: range.endDate,
            },
            metadata: { source: "GOOGLE_SEARCH_CONSOLE", reportKey: definition.key, grain: definition.grain },
          });
        }
        hasMore = result.rows.length >= 25_000;
        startRow += result.rows.length;
        if (result.rows.length === 0) hasMore = false;
      }
    }

    if (records.length === 0) return null;

    const batch = await marketingWarehouseIngestionService.createBatch(
      {
        brandId: account.brandId,
        organisationId: account.organisationId,
        marketingDataSourceAccountId: warehouseAccount.id,
        provider: "GOOGLE_SEARCH_CONSOLE",
        syncType: batchSyncType,
        idempotencyKey: `gsc-batch:${account.id}:${syncId}`,
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
      },
    });

    await prisma.marketingDataSourceAccount.update({
      where: { id: warehouseAccount.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: "COMPLETED" },
    });

    return batch;
  },

  async refreshSitemaps(connectorAccountId: string, siteUrl: string, context: TenantContext) {
    const account = await prisma.connectorAccount.findUnique({ where: { id: connectorAccountId } });
    if (!account) return;
    const tokens = await connectorCredentialService.readTokens(connectorAccountId);
    if (!tokens?.accessToken) return;

    const sitemaps = await gscSearchConsoleAdapter.listSitemaps(tokens.accessToken, siteUrl);
    for (const sitemap of sitemaps) {
      const discoveredUrls = sitemap.contents?.reduce((sum, item) => sum + (item.submitted ?? 0), 0);
      await prisma.searchConsoleSitemap.upsert({
        where: {
          connectorAccountId_sitemapPath: {
            connectorAccountId,
            sitemapPath: sitemap.path,
          },
        },
        create: {
          organisationId: account.organisationId,
          projectId: account.projectId,
          brandId: account.brandId,
          connectorAccountId,
          siteUrl,
          sitemapPath: sitemap.path,
          lastSubmitted: sitemap.lastSubmitted ? new Date(sitemap.lastSubmitted) : undefined,
          lastDownloaded: sitemap.lastDownloaded ? new Date(sitemap.lastDownloaded) : undefined,
          warnings: sitemap.warnings ?? 0,
          errors: sitemap.errors ?? 0,
          discoveredUrls: discoveredUrls ?? undefined,
          isPending: sitemap.isPending ?? false,
          rawResponse: sitemap as Prisma.InputJsonValue,
        },
        update: {
          lastSubmitted: sitemap.lastSubmitted ? new Date(sitemap.lastSubmitted) : undefined,
          lastDownloaded: sitemap.lastDownloaded ? new Date(sitemap.lastDownloaded) : undefined,
          warnings: sitemap.warnings ?? 0,
          errors: sitemap.errors ?? 0,
          discoveredUrls: discoveredUrls ?? undefined,
          isPending: sitemap.isPending ?? false,
          rawResponse: sitemap as Prisma.InputJsonValue,
          fetchedAt: new Date(),
        },
      });
    }
  },

  async inspectUrl(
    brandId: string,
    organisationId: string,
    inspectionUrl: string,
    context: TenantContext,
    userProfileId?: string,
  ) {
    const account = await gscConnectionService.requireConnectorAccount(brandId, organisationId, context);
    if (!account.externalAccountId) {
      throw new AppError("VALIDATION_ERROR", "Select a Search Console property first.");
    }

    const todayCount = await prisma.searchConsoleUrlInspection.count({
      where: {
        connectorAccountId: account.id,
        inspectedAt: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) },
      },
    });
    if (todayCount >= 50) {
      throw new AppError("RATE_LIMITED", "Daily URL inspection limit reached for this property.");
    }

    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Google account is not connected.");

    const result = await gscSearchConsoleAdapter.inspectUrl(
      tokens.accessToken,
      account.externalAccountId,
      inspectionUrl,
    );

    return prisma.searchConsoleUrlInspection.create({
      data: {
        organisationId: account.organisationId,
        projectId: account.projectId,
        brandId: account.brandId,
        connectorAccountId: account.id,
        siteUrl: account.externalAccountId,
        inspectionUrl,
        indexedState: result.indexedState,
        crawlState: result.crawlState,
        canonicalUrl: result.canonicalUrl,
        robotsTxtState: result.robotsTxtState,
        lastCrawlTime: result.lastCrawlTime ? new Date(result.lastCrawlTime) : undefined,
        mobileUsability: result.mobileUsability,
        richResultsState: result.richResultsState,
        rawResponse: result.raw as Prisma.InputJsonValue,
        inspectedByUserId: userProfileId,
      },
    });
  },
};
