import type { MarketingDataProvider, Prisma, RawMarketingBatchStatus, RawMarketingBatchSyncType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getWarehouseConfig } from "@/lib/warehouse/config";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import { hashPayload } from "@/lib/warehouse/payload-hash";
import { chunkArray } from "@/lib/warehouse/chunking";
import { ensureRawSchemaVersion } from "@/lib/warehouse/transformation-version";
import type { TenantContext } from "@/lib/tenancy/context";
import type { WarehouseIngestBatchInput } from "@/lib/validation/warehouse";
import { recordAuditEvent } from "@/server/services/audit-service";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";
import { brandService } from "@/server/services/workspace-service";

type IngestRecord = WarehouseIngestBatchInput["records"][number];

export const marketingWarehouseIngestionService = {
  async createBatch(
    input: {
      brandId: string;
      organisationId: string;
      marketingDataSourceAccountId?: string;
      provider?: MarketingDataProvider;
      syncType: RawMarketingBatchSyncType;
      idempotencyKey: string;
      records?: IngestRecord[];
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const config = getWarehouseConfig();
    if (!config.enabled) {
      throw new AppError("VALIDATION_ERROR", "Marketing data warehouse is disabled.");
    }

    const brand = await brandService.getById(input.brandId, input.organisationId, context);
    const account = input.marketingDataSourceAccountId
      ? await prisma.marketingDataSourceAccount.findFirst({
          where: {
            id: input.marketingDataSourceAccountId,
            organisationId: input.organisationId,
            brandId: input.brandId,
          },
          include: { marketingDataSource: true },
        })
      : await marketingWarehouseRegistryService.ensureSourceAccount({
          brandId: input.brandId,
          organisationId: input.organisationId,
          projectId: brand.projectId,
          provider: input.provider ?? "MANUAL_IMPORT",
        });

    if (!account) {
      throw new AppError("NOT_FOUND", "Marketing data source account was not found.");
    }

    const existing = await prisma.rawMarketingBatch.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const batch = await prisma.rawMarketingBatch.create({
      data: {
        organisationId: input.organisationId,
        projectId: brand.projectId,
        brandId: input.brandId,
        marketingDataSourceAccountId: account.id,
        provider: account.marketingDataSource?.provider ?? input.provider ?? "MANUAL_IMPORT",
        syncType: input.syncType,
        idempotencyKey: input.idempotencyKey,
        status: input.records?.length ? "RUNNING" : "QUEUED",
        startedAt: input.records?.length ? new Date() : undefined,
      },
    });

    incrementWarehouseCounter("warehouse.batches_created", 1, { batchId: batch.id });

    if (input.records?.length) {
      await this.ingestRecordsInChunks(batch.id, input.records, context, requestId);
    }

    await recordAuditEvent({
      organisationId: input.organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.batch.created",
      resourceType: "RawMarketingBatch",
      resourceId: batch.id,
      requestId,
      metadata: { syncType: input.syncType, recordCount: input.records?.length ?? 0 },
    });

    return prisma.rawMarketingBatch.findUniqueOrThrow({ where: { id: batch.id } });
  },

  async ingestRecordsInChunks(
    batchId: string,
    records: IngestRecord[],
    context: TenantContext,
    requestId?: string,
  ) {
    const config = getWarehouseConfig();
    const chunks = chunkArray(records, config.maxBatchSize);
    let received = 0;
    let deduped = 0;
    let failed = 0;

    for (const chunk of chunks) {
      const result = await this.ingestRecords(batchId, chunk, context, requestId);
      received += result.received;
      deduped += result.deduped;
      failed += result.failed;
    }

    return { received, deduped, failed };
  },

  async ingestRecords(
    batchId: string,
    records: IngestRecord[],
    context: TenantContext,
    requestId?: string,
  ) {
    const config = getWarehouseConfig();
    if (records.length > config.maxBatchSize) {
      throw new AppError("VALIDATION_ERROR", `Batch exceeds max size of ${config.maxBatchSize}.`);
    }

    const batch = await prisma.rawMarketingBatch.findUnique({
      where: { id: batchId },
      include: { marketingDataSourceAccount: { include: { marketingDataSource: true } } },
    });
    if (!batch || batch.organisationId !== context.organisationId) {
      throw new AppError("NOT_FOUND", "Batch was not found.");
    }

    const schemaVersion = batch.marketingDataSourceAccount.marketingDataSource?.id
      ? await ensureRawSchemaVersion(batch.marketingDataSourceAccount.marketingDataSource.id)
      : null;

    let received = 0;
    let deduped = 0;
    let failed = 0;

    for (const record of records) {
      const payloadHash = hashPayload(record.payload);
      const idempotencyKey = `record:${batch.marketingDataSourceAccountId}:${record.providerRecordId}:${record.recordType}:${payloadHash}`;

      const duplicate = await prisma.rawMarketingRecord.findFirst({
        where: {
          marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
          checksum: payloadHash,
          providerRecordId: record.providerRecordId,
        },
      });
      if (duplicate) {
        deduped += 1;
        incrementWarehouseCounter("warehouse.records_deduped");
        continue;
      }

      try {
        await prisma.rawMarketingRecord.upsert({
          where: {
            marketingDataSourceAccountId_providerRecordId_recordType: {
              marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
              providerRecordId: record.providerRecordId,
              recordType: record.recordType,
            },
          },
          create: {
            organisationId: batch.organisationId,
            projectId: batch.projectId,
            brandId: batch.brandId,
            marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
            rawMarketingBatchId: batch.id,
            schemaVersionId: schemaVersion?.id,
            provider: batch.provider,
            providerRecordId: record.providerRecordId,
            recordType: record.recordType,
            eventTime: record.eventTime ? new Date(record.eventTime) : undefined,
            idempotencyKey,
            checksum: payloadHash,
            inlinePayload: record.payload as Prisma.InputJsonValue,
            metadata: record.metadata as Prisma.InputJsonValue | undefined,
            status: "RECEIVED",
          },
          update: {
            rawMarketingBatchId: batch.id,
            schemaVersionId: schemaVersion?.id,
            checksum: payloadHash,
            inlinePayload: record.payload as Prisma.InputJsonValue,
            metadata: record.metadata as Prisma.InputJsonValue | undefined,
            status: "RECEIVED",
          },
        });
        received += 1;
        incrementWarehouseCounter("warehouse.records_ingested");
      } catch {
        failed += 1;
        incrementWarehouseCounter("warehouse.records_rejected");
      }
    }

    const status =
      failed > 0 && received === 0 ? "FAILED" : failed > 0 ? "PARTIAL" : received > 0 ? "COMPLETED" : "COMPLETED";

    const updated = await prisma.rawMarketingBatch.update({
      where: { id: batch.id },
      data: {
        recordsReceived: { increment: received },
        recordsProcessed: { increment: received },
        recordsFailed: { increment: failed },
        status,
        completedAt: new Date(),
        heartbeatAt: new Date(),
      },
    });

    if (status === "COMPLETED") {
      incrementWarehouseCounter("warehouse.batches_completed");
    } else if (status === "FAILED") {
      incrementWarehouseCounter("warehouse.batches_failed");
    }

    await recordAuditEvent({
      organisationId: batch.organisationId,
      projectId: batch.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.batch.ingested",
      resourceType: "RawMarketingBatch",
      resourceId: batch.id,
      requestId,
      metadata: { received, deduped, failed },
    });

    return { batch: updated, received, deduped, failed };
  },

  async listBatches(
    brandId: string,
    organisationId: string,
    filters: { status?: string; cursor?: string; limit: number },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const limit = filters.limit;
    const items = await prisma.rawMarketingBatch.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters.status ? { status: filters.status as RawMarketingBatchStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        marketingDataSourceAccount: {
          include: { marketingDataSource: { select: { key: true, displayName: true, provider: true } } },
        },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  },

  async getBatch(batchId: string, organisationId: string, context: TenantContext) {
    const batch = await prisma.rawMarketingBatch.findFirst({
      where: { id: batchId, organisationId },
      include: {
        rawRecords: { take: 100, orderBy: { receivedAt: "desc" } },
        marketingDataSourceAccount: { include: { marketingDataSource: true } },
      },
    });
    if (!batch) {
      throw new AppError("NOT_FOUND", "Batch was not found.");
    }
    return batch;
  },
};
