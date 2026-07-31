import type { LongFormExportFormat } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  checksumPayload,
  exportToCmsPayload,
  exportToCopyText,
  exportToHandoff,
  exportToHtml,
  exportToJson,
  exportToMarkdown,
  type ExportDocument,
} from "@/lib/long-form/export";
import type { TenantContext } from "@/lib/tenancy/context";
import { longFormDocumentService } from "@/server/services/long-form-document-service";

function toExportDocument(doc: Awaited<ReturnType<typeof longFormDocumentService.getById>>): ExportDocument {
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    metaDescription: doc.metaDescription,
    contentType: doc.contentType,
    status: doc.status,
    sections: doc.sections.map((s) => ({
      id: s.id,
      sortOrder: s.sortOrder,
      heading: s.heading,
      headingLevel: s.headingLevel,
      blockType: s.blockType,
      body: s.body,
      isLocked: s.isLocked,
    })),
    citations: doc.citations.map((c) => ({ label: c.label, url: c.url })),
  };
}

export const longFormExportService = {
  async export(
    documentId: string,
    brandId: string,
    organisationId: string,
    format: LongFormExportFormat,
    context: TenantContext,
  ) {
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);

    if (!["APPROVED", "PUBLISH_READY"].includes(doc.status)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Document must be approved or publish-ready before export. No automatic publishing.",
      );
    }

    const exportDoc = toExportDocument(doc);
    let payload: unknown;

    switch (format) {
      case "HTML":
        payload = { content: exportToHtml(exportDoc) };
        break;
      case "MARKDOWN":
        payload = { content: exportToMarkdown(exportDoc) };
        break;
      case "JSON":
        payload = exportToJson(exportDoc);
        break;
      case "CMS_PAYLOAD":
        payload = exportToCmsPayload(exportDoc);
        break;
      case "COPY":
        payload = { content: exportToCopyText(exportDoc) };
        break;
      case "HANDOFF":
        payload = exportToHandoff(exportDoc);
        break;
      default:
        throw new AppError("VALIDATION_ERROR", `Unsupported export format: ${format}`);
    }

    const checksum = checksumPayload(payload);
    const record = await prisma.longFormExport.create({
      data: {
        organisationId,
        documentId,
        versionId: doc.currentVersionId,
        format,
        payload: payload as object,
        checksum,
        createdByUserId: context.userProfileId,
      },
    });

    return { export: record, payload, publishReady: false };
  },

  async listExports(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    await longFormDocumentService.getById(documentId, brandId, organisationId, context);
    return prisma.longFormExport.findMany({
      where: { documentId, organisationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  },
};
