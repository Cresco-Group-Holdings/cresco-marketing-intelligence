import { createHash } from "node:crypto";
import type { Prisma, SeoKeywordMetricType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { sanitizeCsvRow } from "@/lib/warehouse/csv-safety";
import { normaliseKeyword } from "@/lib/keywords/normalisation";
import type { TenantContext } from "@/lib/tenancy/context";
import { seoKeywordService } from "@/server/services/seo-keyword-service";
import { brandService } from "@/server/services/workspace-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new AppError("VALIDATION_ERROR", "CSV must include header and at least one data row.");
  }
  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line, index) => {
    const values = line.split(",").map((v) => v.trim());
    const row = sanitizeCsvRow(
      Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])),
    );
    return { ...row, _rowNumber: String(index + 2) };
  });
  return { headers, rows };
}

function mapRow(
  row: Record<string, string>,
  mappings?: Array<{ sourceColumn: string; targetField: string }>,
): Record<string, string> {
  if (!mappings?.length) return row;
  return Object.fromEntries(
    mappings.map((m) => [m.targetField, row[m.sourceColumn] ?? ""]),
  );
}

const METRIC_FIELD_MAP: Record<string, SeoKeywordMetricType> = {
  volume: "SEARCH_VOLUME",
  cpc: "CPC",
  difficulty: "DIFFICULTY",
  position: "RANK_POSITION",
};

export const seoKeywordImportService = {
  async createPreview(
    brandId: string,
    organisationId: string,
    input: {
      fileName: string;
      csvContent: string;
      idempotencyKey: string;
      siteId?: string;
      provider?: string;
      columnMappings?: Array<{ sourceColumn: string; targetField: string; isRequired?: boolean }>;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const existing = await prisma.seoKeywordImport.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const { headers, rows } = parseCsv(input.csvContent);
    const preview = rows.slice(0, 5).map((row) => mapRow(row, input.columnMappings));
    const rejected: Array<{ rowNumber: number; reason: string }> = [];

    for (const row of rows) {
      const mapped = mapRow(row, input.columnMappings);
      if (!mapped.keyword?.trim()) {
        rejected.push({ rowNumber: Number(row._rowNumber), reason: "Missing keyword." });
      }
    }

    return prisma.seoKeywordImport.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        seoSiteId: input.siteId,
        status: rejected.length === rows.length ? "FAILED" : "PREVIEW",
        fileName: input.fileName,
        provider: input.provider ?? "CSV_IMPORT",
        rowCount: rows.length,
        rejectedCount: rejected.length,
        idempotencyKey: input.idempotencyKey,
        columnMappings: input.columnMappings as Prisma.InputJsonValue,
        preview: { headers, preview, rowCount: rows.length } as Prisma.InputJsonValue,
        rejectedRows: rejected as unknown as Prisma.InputJsonValue,
        createdByUserId: context.userProfileId,
      },
    });
  },

  async confirm(importId: string, brandId: string, organisationId: string, context: TenantContext) {
    const job = await prisma.seoKeywordImport.findFirst({
      where: { id: importId, organisationId, brandId },
    });
    if (!job) throw new AppError("NOT_FOUND", "Import not found.");
    if (job.status === "COMPLETED") return job;
    if (!job.preview || typeof job.preview !== "object") {
      throw new AppError("VALIDATION_ERROR", "Import has no preview data.");
    }

    await prisma.seoKeywordImport.update({
      where: { id: importId },
      data: { status: "PROCESSING" },
    });

    const preview = job.preview as { headers: string[]; preview: Record<string, string>[]; rowCount: number };
    const mappings = job.columnMappings as Array<{ sourceColumn: string; targetField: string }> | null;
    const { rows } = parseCsv(
      // Re-process from stored preview metadata — in production would store raw CSV
      [preview.headers.join(","), ...preview.preview.map((r) => preview.headers.map((h) => r[h] ?? "").join(","))].join("\n"),
    );

    let accepted = 0;
    const rejected: Array<{ rowNumber: number; reason: string }> = [];

    for (const row of rows) {
      const mapped = mapRow(row, mappings ?? undefined);
      const keywordText = mapped.keyword?.trim();
      if (!keywordText) {
        rejected.push({ rowNumber: Number(row._rowNumber ?? 0), reason: "Missing keyword." });
        continue;
      }

      const keyword = await seoKeywordService.upsert(
        brandId,
        organisationId,
        {
          keyword: keywordText,
          language: mapped.language ?? "en",
          country: mapped.country,
          siteId: job.seoSiteId ?? undefined,
          sourceType: "CSV_IMPORT",
          provider: job.provider,
          externalId: digest(`csv:${importId}:${row._rowNumber}:${keywordText}`),
          tags: mapped.tags?.split(";").map((t) => t.trim()).filter(Boolean),
        },
        context,
      );

      for (const [field, metricType] of Object.entries(METRIC_FIELD_MAP)) {
        const raw = mapped[field];
        if (!raw) continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) continue;
        await prisma.seoKeywordMetric.upsert({
          where: {
            keywordId_metricType_provider_source_location_language_measuredAt: {
              keywordId: keyword.id,
              metricType,
              provider: job.provider,
              source: "CSV_IMPORT",
              location: mapped.country ?? "",
              language: mapped.language ?? "en",
              measuredAt: new Date(),
            },
          },
          create: {
            organisationId,
            keywordId: keyword.id,
            metricType,
            provider: job.provider,
            source: "CSV_IMPORT",
            location: mapped.country,
            language: mapped.language ?? "en",
            value,
            measuredAt: new Date(),
            providerDefinition: `CSV import ${job.fileName}`,
            confidence: 0.8,
          },
          update: { value, measuredAt: new Date() },
        });
      }

      if (mapped.url) {
        await prisma.seoKeywordPageMapping.create({
          data: {
            organisationId,
            keywordId: keyword.id,
            intendedUrl: mapped.url,
            relationType: "CURRENTLY_RANKING",
            evidence: { source: "CSV_IMPORT" } as Prisma.InputJsonValue,
          },
        });
      }

      accepted += 1;
    }

    return prisma.seoKeywordImport.update({
      where: { id: importId },
      data: {
        status: "COMPLETED",
        acceptedCount: accepted,
        rejectedCount: rejected.length,
        rejectedRows: rejected as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  },
};
