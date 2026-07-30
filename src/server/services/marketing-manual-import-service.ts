import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getWarehouseConfig } from "@/lib/warehouse/config";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { marketingWarehouseIngestionService } from "@/server/services/marketing-warehouse-ingestion-service";
import { marketingWarehouseNormalisationService } from "@/server/services/marketing-warehouse-normalisation-service";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";
import { brandService } from "@/server/services/workspace-service";

type ParsedRow = Record<string, string>;

function parseCsv(content: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new AppError("VALIDATION_ERROR", "CSV must include a header row and at least one data row.");
  }

  const headers = lines[0]!.split(",").map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  return { headers, rows };
}

function rowToPayload(row: ParsedRow, mappings?: Array<{ sourceColumn: string; targetField: string }>) {
  if (!mappings?.length) {
    return row;
  }
  return Object.fromEntries(
    mappings.map((mapping) => [mapping.targetField, row[mapping.sourceColumn] ?? ""]),
  );
}

export const marketingManualImportService = {
  async createImport(
    organisationId: string,
    input: {
      brandId: string;
      fileName: string;
      csvContent: string;
      idempotencyKey: string;
      columnMappings?: Array<{ sourceColumn: string; targetField: string; isRequired?: boolean }>;
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const config = getWarehouseConfig();
    const brand = await brandService.getById(input.brandId, organisationId, context);
    const { headers, rows } = parseCsv(input.csvContent);

    if (rows.length > config.maxImportRows) {
      throw new AppError("VALIDATION_ERROR", `Import exceeds max rows of ${config.maxImportRows}.`);
    }

    const existing = await prisma.manualImportJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { job: existing, preview: existing.metadata };
    }

    const account = await marketingWarehouseRegistryService.ensureSourceAccount({
      brandId: input.brandId,
      organisationId,
      projectId: brand.projectId,
      provider: "MANUAL_IMPORT",
      displayName: "Manual import",
    });

    const previewRows = rows.slice(0, 5).map((row, index) => ({
      rowNumber: index + 2,
      raw: row,
      mapped: rowToPayload(row, input.columnMappings),
    }));

    const job = await prisma.manualImportJob.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId: input.brandId,
        marketingDataSourceAccountId: account.id,
        createdByUserId: context.userProfileId,
        status: "VALIDATING",
        fileName: input.fileName,
        fileFormat: "CSV",
        fileSizeBytes: Buffer.byteLength(input.csvContent, "utf8"),
        rowCount: rows.length,
        idempotencyKey: input.idempotencyKey,
        uploadedAt: new Date(),
        metadata: {
          headers,
          previewRows,
          validation: { valid: true, rowCount: rows.length },
        } as Prisma.InputJsonValue,
        mappings: input.columnMappings
          ? {
              create: input.columnMappings.map((mapping) => ({
                organisationId,
                projectId: brand.projectId,
                brandId: input.brandId,
                sourceColumn: mapping.sourceColumn,
                targetField: mapping.targetField,
                isRequired: mapping.isRequired ?? false,
              })),
            }
          : undefined,
      },
      include: { mappings: true },
    });

    incrementWarehouseCounter("warehouse.imports_started");

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.import.created",
      resourceType: "ManualImportJob",
      resourceId: job.id,
      requestId,
      metadata: { fileName: input.fileName, rowCount: rows.length },
    });

    return {
      job,
      preview: {
        headers,
        rowCount: rows.length,
        sampleRows: previewRows,
      },
    };
  },

  async confirmImport(
    organisationId: string,
    input: { brandId: string; importId: string; csvContent?: string },
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(input.brandId, organisationId, context);
    const job = await prisma.manualImportJob.findFirst({
      where: { id: input.importId, organisationId, brandId: input.brandId },
      include: { mappings: true },
    });
    if (!job) {
      throw new AppError("NOT_FOUND", "Import job was not found.");
    }
    if (job.status === "COMPLETED") {
      return job;
    }

    const metadata = (job.metadata ?? {}) as { storedCsv?: string };
    const csvContent = input.csvContent ?? metadata.storedCsv;
    if (!csvContent) {
      throw new AppError(
        "VALIDATION_ERROR",
        "CSV content is required to confirm import. Re-submit with csvContent.",
      );
    }

    const { rows } = parseCsv(csvContent);
    const mappings = job.mappings.map((mapping: { sourceColumn: string; targetField: string }) => ({
      sourceColumn: mapping.sourceColumn,
      targetField: mapping.targetField,
    }));

    await prisma.manualImportJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING" },
    });

    const records = rows.map((row, index) => {
      const payload = rowToPayload(row, mappings);
      const observedAt =
        typeof payload.observedAt === "string" && payload.observedAt
          ? payload.observedAt
          : new Date().toISOString();
      return {
        providerRecordId: `import:${job.id}:${index + 1}`,
        recordType: "metric",
        eventTime: observedAt,
        payload: { ...payload, observedAt },
      };
    });

    const batch = await marketingWarehouseIngestionService.createBatch(
      {
        brandId: input.brandId,
        organisationId,
        marketingDataSourceAccountId: job.marketingDataSourceAccountId ?? undefined,
        provider: "MANUAL_IMPORT",
        syncType: "MANUAL",
        idempotencyKey: `import-batch:${job.id}`,
        records,
      },
      context,
      requestId,
    );

    await marketingWarehouseNormalisationService.normaliseBatch(batch.id, context, requestId);

    const completed = await prisma.manualImportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        rowsProcessed: records.length,
        completedAt: new Date(),
      },
    });

    incrementWarehouseCounter("warehouse.imports_completed");

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.import.confirmed",
      resourceType: "ManualImportJob",
      resourceId: job.id,
      requestId,
      metadata: { batchId: batch.id, rowsProcessed: records.length },
    });

    return completed;
  },

  async listImports(
    brandId: string,
    organisationId: string,
    filters: { cursor?: string; limit: number },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const items = await prisma.manualImportJob.findMany({
      where: { organisationId, brandId },
      orderBy: { createdAt: "desc" },
      take: filters.limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: { mappings: true },
    });

    const hasMore = items.length > filters.limit;
    const page = hasMore ? items.slice(0, filters.limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },
};
