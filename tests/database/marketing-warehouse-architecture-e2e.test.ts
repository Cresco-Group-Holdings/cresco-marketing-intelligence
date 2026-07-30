import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

function csvRow(index: number) {
  return `row-${index},${index + 1},2026-07-29T12:00:00Z`;
}

function csvContent(rowCount: number) {
  const rows = Array.from({ length: rowCount }, (_, index) => csvRow(index + 1));
  return ["campaign,clicks,observedAt", ...rows].join("\n");
}

suite("marketing warehouse architecture closure", () => {
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
    const aggregate = await import("@/server/services/marketing-warehouse-aggregate-service");
    const quality = await import("@/server/services/marketing-warehouse-quality-service");
    const correction = await import("@/server/services/marketing-warehouse-correction-service");
    const manualImport = await import("@/server/services/marketing-manual-import-service");
    const query = await import("@/server/services/marketing-warehouse-query-service");
    return {
      ingestionService: ingestion.marketingWarehouseIngestionService,
      normalisationService: normalisation.marketingWarehouseNormalisationService,
      aggregateService: aggregate.marketingWarehouseAggregateService,
      qualityService: quality.marketingWarehouseQualityService,
      correctionService: correction.marketingWarehouseCorrectionService,
      manualImportService: manualImport.marketingManualImportService,
      queryService: query.marketingWarehouseQueryService,
    };
  }

  it("chunks a 10,000-row import across multiple ingestion calls without exceeding batch limits", async () => {
    const { manualImportService } = await services();
    const csv = csvContent(10_000);

    const preview = await manualImportService.createImport(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        fileName: "large.csv",
        csvContent: csv,
        idempotencyKey: `large-import-${tenantA.id}`,
      },
      tenantA.context as never,
    );

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
    expect(completed.rowsProcessed).toBe(10_000);

    const batches = await prisma.rawMarketingBatch.findMany({
      where: { organisationId: tenantA.organisation.id, brandId: tenantA.brand.id },
    });
    expect(batches).toHaveLength(1);

    const records = await prisma.rawMarketingRecord.count({
      where: { organisationId: tenantA.organisation.id, brandId: tenantA.brand.id },
    });
    expect(records).toBe(10_000);
  });

  it("rejects a single ingest call above 5,000 records", async () => {
    const { ingestionService } = await services();
    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `oversize-${tenantA.id}`,
      },
      tenantA.context as never,
    );

    const records = Array.from({ length: 5_001 }, (_, index) => ({
      providerRecordId: `oversize-${index}`,
      recordType: "metric",
      payload: { clicks: index },
    }));

    await expect(
      ingestionService.ingestRecords(batch.id, records, tenantA.context as never),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("reprocesses normalisation idempotently without duplicate observations or events", async () => {
    const { ingestionService, normalisationService } = await services();

    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `idempotent-${tenantA.id}`,
        records: [
          {
            providerRecordId: "metric-row-1",
            recordType: "metric",
            eventTime: "2026-07-29T12:00:00Z",
            payload: { clicks: 40, impressions: 400, source: "paid_social" },
          },
        ],
      },
      tenantA.context as never,
    );

    const first = await normalisationService.normaliseBatch(batch.id, tenantA.context as never);
    const second = await normalisationService.normaliseBatch(batch.id, tenantA.context as never);

    expect(first.processed).toBe(1);
    expect(second.processed).toBe(1);
    expect(second.resumed).toBe(false);

    const observations = await prisma.marketingMetricObservation.findMany({
      where: { organisationId: tenantA.organisation.id, brandId: tenantA.brand.id },
    });
    expect(observations).toHaveLength(2);

    const lineage = await prisma.dataLineageRecord.findMany({
      where: { organisationId: tenantA.organisation.id, brandId: tenantA.brand.id },
    });
    const metricLineage = lineage.filter((record) => record.entityType === "METRIC");
    expect(metricLineage).toHaveLength(2);
  });

  it("applies metric corrections once in aggregates and preserves correction history", async () => {
    const { ingestionService, normalisationService, correctionService, aggregateService } =
      await services();

    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `correction-${tenantA.id}`,
        records: [
          {
            providerRecordId: "metric-row-correction",
            recordType: "metric",
            eventTime: "2026-07-29T12:00:00Z",
            payload: { clicks: 100 },
          },
        ],
      },
      tenantA.context as never,
    );
    await normalisationService.normaliseBatch(batch.id, tenantA.context as never);

    const observation = await prisma.marketingMetricObservation.findFirstOrThrow({
      where: { organisationId: tenantA.organisation.id, metricKey: "clicks" },
    });

    await correctionService.applyCorrection(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        observationId: observation.id,
        correctedValue: 75,
        reason: "Provider restated value",
      },
      tenantA.context as never,
    );

    const from = new Date("2026-07-01T00:00:00Z");
    const to = new Date("2026-07-31T23:59:59Z");

    await aggregateService.refreshDailyAggregates(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        from,
        to,
        idempotencyKey: `aggregate-correction-${tenantA.id}`,
      },
      tenantA.context as never,
    );

    const aggregate = await prisma.dailyMarketingAggregate.findFirst({
      where: { brandId: tenantA.brand.id, metricKey: "clicks" },
    });
    expect(Number(aggregate?.value)).toBe(75);

    const corrections = await prisma.marketingMetricCorrection.findMany({
      where: { marketingMetricObservationId: observation.id },
    });
    expect(corrections).toHaveLength(1);
    expect(Number(corrections[0]?.originalValue)).toBe(100);
    expect(Number(corrections[0]?.correctedValue)).toBe(75);
  });

  it("prevents duplicate quality issues and preserves resolution history", async () => {
    const { ingestionService, normalisationService, qualityService } = await services();

    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `quality-${tenantA.id}`,
        records: [
          {
            providerRecordId: "zero-metric",
            recordType: "metric",
            eventTime: "2026-07-29T12:00:00Z",
            payload: { clicks: 0 },
          },
        ],
      },
      tenantA.context as never,
    );
    await normalisationService.normaliseBatch(batch.id, tenantA.context as never);

    await qualityService.runQualityChecks(
      tenantA.brand.id,
      tenantA.organisation.id,
      tenantA.context as never,
      batch.id,
    );
    await qualityService.runQualityChecks(
      tenantA.brand.id,
      tenantA.organisation.id,
      tenantA.context as never,
      batch.id,
    );

    const issues = await prisma.dataQualityIssue.findMany({
      where: { organisationId: tenantA.organisation.id, brandId: tenantA.brand.id },
    });
    expect(issues.length).toBeGreaterThanOrEqual(1);

    const observation = await prisma.marketingMetricObservation.findFirstOrThrow({
      where: { organisationId: tenantA.organisation.id, metricKey: "clicks" },
    });
    const openIssues = issues.filter(
      (issue) => issue.entityId === observation.id && issue.status === "OPEN",
    );
    expect(openIssues).toHaveLength(1);

    await qualityService.resolveIssue(
      tenantA.brand.id,
      tenantA.organisation.id,
      { issueId: openIssues[0]!.id, action: "FALSE_POSITIVE", notes: "Expected zero" },
      tenantA.context as never,
    );

    const resolutions = await prisma.dataQualityResolution.findMany({
      where: { dataQualityIssueId: openIssues[0]!.id },
    });
    expect(resolutions).toHaveLength(1);
  });

  it("isolates warehouse data across organisations and brands", async () => {
    const { ingestionService, queryService } = await services();

    await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `tenant-a-${tenantA.id}`,
        records: [
          {
            providerRecordId: "shared-provider-id",
            recordType: "metric",
            payload: { clicks: 11 },
          },
        ],
      },
      tenantA.context as never,
    );

    await ingestionService.createBatch(
      {
        brandId: tenantB.brand.id,
        organisationId: tenantB.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `tenant-b-${tenantB.id}`,
        records: [
          {
            providerRecordId: "shared-provider-id",
            recordType: "metric",
            payload: { clicks: 22 },
          },
        ],
      },
      tenantB.context as never,
    );

    const from = new Date("2026-07-01T00:00:00Z");
    const to = new Date("2026-07-31T23:59:59Z");

    const tenantAMetrics = await queryService.queryMetrics(
      tenantA.organisation.id,
      { brandId: tenantA.brand.id, from, to, limit: 25, sortDirection: "desc" },
      tenantA.context as never,
    );
    const tenantBMetrics = await queryService.queryMetrics(
      tenantB.organisation.id,
      { brandId: tenantB.brand.id, from, to, limit: 25, sortDirection: "desc" },
      tenantB.context as never,
    );

    expect(tenantAMetrics.items.every((item) => item.organisationId === tenantA.organisation.id)).toBe(
      true,
    );
    expect(tenantBMetrics.items.every((item) => item.organisationId === tenantB.organisation.id)).toBe(
      true,
    );

    await expect(
      queryService.queryMetrics(
        tenantB.organisation.id,
        { brandId: tenantA.brand.id, from, to, limit: 25, sortDirection: "desc" },
        tenantB.context as never,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cannot confirm the same manual import twice", async () => {
    const { manualImportService } = await services();
    const csv = ["campaign,clicks,observedAt", "summer,5,2026-07-29T10:00:00Z"].join("\n");

    const preview = await manualImportService.createImport(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        fileName: "once.csv",
        csvContent: csv,
        idempotencyKey: `once-${tenantA.id}`,
      },
      tenantA.context as never,
    );

    const first = await manualImportService.confirmImport(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        importId: preview.job.id,
        csvContent: csv,
      },
      tenantA.context as never,
    );
    const second = await manualImportService.confirmImport(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        importId: preview.job.id,
        csvContent: csv,
      },
      tenantA.context as never,
    );

    expect(first.status).toBe("COMPLETED");
    expect(second.id).toBe(first.id);

    const records = await prisma.rawMarketingRecord.count({
      where: { organisationId: tenantA.organisation.id, brandId: tenantA.brand.id },
    });
    expect(records).toBe(1);
  });

  it("stores schema and transformation versions without mutating raw payloads on reprocess", async () => {
    const { ingestionService, normalisationService } = await services();

    const batch = await ingestionService.createBatch(
      {
        brandId: tenantA.brand.id,
        organisationId: tenantA.organisation.id,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `schema-${tenantA.id}`,
        records: [
          {
            providerRecordId: "schema-row",
            recordType: "metric",
            payload: { clicks: 12 },
          },
        ],
      },
      tenantA.context as never,
    );

    await normalisationService.normaliseBatch(batch.id, tenantA.context as never);

    const raw = await prisma.rawMarketingRecord.findFirstOrThrow({
      where: { providerRecordId: "schema-row" },
      include: { schemaVersion: true },
    });
    const originalPayload = raw.inlinePayload;
    expect(raw.schemaVersion?.version).toBeTruthy();

    await normalisationService.normaliseBatch(batch.id, tenantA.context as never);

    const unchanged = await prisma.rawMarketingRecord.findFirstOrThrow({
      where: { id: raw.id },
    });
    expect(unchanged.inlinePayload).toEqual(originalPayload);

    const run = await prisma.dataTransformationRun.findFirstOrThrow({
      where: { rawMarketingBatchId: batch.id },
      include: { transformationVersion: true },
    });
    expect(run.transformationVersion?.version).toBeTruthy();
  });
});
