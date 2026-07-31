import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

type ImportPreviewPayload = {
  rowCount: number;
};

function isImportPreviewPayload(value: unknown): value is ImportPreviewPayload {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return typeof Reflect.get(value, "rowCount") === "number";
}

function assertImportPreviewPayload(value: unknown): ImportPreviewPayload {
  if (!isImportPreviewPayload(value)) {
    throw new Error("Expected import preview payload with numeric rowCount");
  }
  return value;
}

suite("marketing data warehouse against a real database", () => {
  let tenantA: Awaited<ReturnType<typeof createTenant>>;
  let tenantB: Awaited<ReturnType<typeof createTenant>>;

  beforeEach(async () => {
    await resetDatabase();
    tenantA = await createTenant();
    tenantB = await createTenant();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function services() {
    const ingestion = await import("@/server/services/marketing-warehouse-ingestion-service");
    const normalisation = await import("@/server/services/marketing-warehouse-normalisation-service");
    const health = await import("@/server/services/marketing-warehouse-health-service");
    const quality = await import("@/server/services/marketing-warehouse-quality-service");
    const aggregate = await import("@/server/services/marketing-warehouse-aggregate-service");
    const query = await import("@/server/services/marketing-warehouse-query-service");
    const manualImport = await import("@/server/services/marketing-manual-import-service");
    return {
      ingestionService: ingestion.marketingWarehouseIngestionService,
      normalisationService: normalisation.marketingWarehouseNormalisationService,
      healthService: health.marketingWarehouseHealthService,
      qualityService: quality.marketingWarehouseQualityService,
      aggregateService: aggregate.marketingWarehouseAggregateService,
      queryService: query.marketingWarehouseQueryService,
      manualImportService: manualImport.marketingManualImportService,
    };
  }

  it("applies warehouse migrations and exposes core tables", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'MarketingDataSource',
        'RawMarketingBatch',
        'RawMarketingRecord',
        'MarketingMetricObservation',
        'MarketingEvent',
        'DailyMarketingAggregate',
        'WarehouseMarketingChannel'
      )`,
    );
    expect(tables).toHaveLength(7);
  });

  it("ingests, normalises, aggregates, and queries tenant-scoped warehouse data", async () => {
    const {
      ingestionService,
      normalisationService,
      healthService,
      qualityService,
      aggregateService,
      queryService,
    } = await services();

    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `warehouse-e2e-${tenantA.id}`,
        records: [
          {
            providerRecordId: "metric-row-1",
            recordType: "metric",
            eventTime: "2026-07-29T12:00:00Z",
            payload: { clicks: 25, impressions: 500, channel: "paid_social" },
          },
        ],
      },
      tenantA.context as never,
    );

    expect(batch.status).toBe("COMPLETED");

    const normalised = await normalisationService.normaliseBatch(
      batch.id,
      tenantA.context as never,
    );
    expect(normalised.processed).toBe(1);

    const account = await prisma.marketingDataSourceAccount.findFirst({
      where: { brandId: tenantA.brand.id, organisationId: tenantA.organisation.id },
    });
    expect(account).toBeTruthy();

    const health = await healthService.computeHealth(
      account!.id,
      tenantA.organisation.id,
      tenantA.context as never,
    );
    expect(health?.status).toBe("HEALTHY");

    await qualityService.runQualityChecks(
      tenantA.brand.id,
      tenantA.organisation.id,
      tenantA.context as never,
      batch.id,
    );

    const from = new Date("2026-07-01T00:00:00Z");
    const to = new Date("2026-07-31T23:59:59Z");

    await aggregateService.refreshDailyAggregates(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        from,
        to,
        idempotencyKey: `aggregate-${tenantA.id}`,
      },
      tenantA.context as never,
    );

    const metrics = await queryService.queryMetrics(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        from,
        to,
        limit: 25,
        sortDirection: "desc",
      },
      tenantA.context as never,
    );
    expect(metrics.items.length).toBeGreaterThan(0);

    const lineage = await prisma.dataLineageRecord.findMany({
      where: { organisationId: tenantA.organisation.id, brandId: tenantA.brand.id },
    });
    expect(lineage.length).toBeGreaterThan(0);
  });

  it("prevents cross-tenant access to warehouse batches", async () => {
    const { ingestionService } = await services();

    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `tenant-a-batch-${tenantA.id}`,
        records: [
          {
            providerRecordId: "metric-row-tenant-a",
            recordType: "metric",
            payload: { clicks: 5 },
          },
        ],
      },
      tenantA.context as never,
    );

    await expect(
      ingestionService.getBatch(batch.id, tenantB.organisation.id, tenantB.context as never),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("supports CSV import preview and confirmation workflow", async () => {
    const { manualImportService } = await services();
    const csv = [
      "campaign,clicks,observedAt",
      "summer,15,2026-07-29T10:00:00Z",
      "winter,8,2026-07-29T11:00:00Z",
    ].join("\n");

    const preview = await manualImportService.createImport(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        fileName: "campaigns.csv",
        csvContent: csv,
        idempotencyKey: `import-${tenantA.id}`,
      },
      tenantA.context as never,
    );

    const previewPayload = assertImportPreviewPayload(preview.preview);
    expect(previewPayload.rowCount).toBe(2);
    expect(preview.job.status).toBe("VALIDATING");

    const completed = await manualImportService.confirmImport(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        importId: preview.job.id,
        csvContent: csv,
      },
      tenantA.context as never,
    );

    expect(completed.status).toBe("COMPLETED");
    expect(completed.rowsProcessed).toBe(2);

    const observations = await prisma.marketingMetricObservation.findMany({
      where: {
        organisationId: tenantA.organisation.id,
        brandId: tenantA.brand.id,
      },
    });
    expect(observations.length).toBeGreaterThanOrEqual(2);
  });

  it("deduplicates repeated ingestion of the same provider record", async () => {
    const { ingestionService } = await services();

    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `dedupe-batch-${tenantA.id}`,
      },
      tenantA.context as never,
    );

    const record = {
      providerRecordId: "dedupe-row-1",
      recordType: "metric",
      payload: { clicks: 99 },
    };

    const first = await ingestionService.ingestRecords(batch.id, [record], tenantA.context as never);
    const second = await ingestionService.ingestRecords(batch.id, [record], tenantA.context as never);

    expect(first.received).toBe(1);
    expect(second.deduped).toBe(1);
    expect(second.received).toBe(0);
  });
});
