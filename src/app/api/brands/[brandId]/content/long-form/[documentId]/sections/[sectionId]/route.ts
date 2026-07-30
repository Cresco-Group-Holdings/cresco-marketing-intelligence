import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withLongFormGenerate,
  withLongFormManage,
} from "@/lib/api/long-form-handler";
import { sectionActionSchema, updateSectionSchema } from "@/lib/validation/long-form";
import { longFormDocumentService } from "@/server/services/long-form-document-service";
import { longFormGenerationService } from "@/server/services/long-form-generation-service";

type Params = { params: Promise<{ brandId: string; documentId: string; sectionId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, documentId, sectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withLongFormManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateSectionSchema, body);
    const section = await longFormDocumentService.updateSection(
      documentId,
      sectionId,
      brandId,
      organisationId,
      input,
      tenant!,
    );
    return apiSuccess({ section }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, documentId, sectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withLongFormGenerate(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(sectionActionSchema, body);
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, tenant!);
    const sectionIndex = doc.sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex < 0) throw new AppError("NOT_FOUND", "Section not found.");
    const result = await longFormGenerationService.generateSection(
      documentId,
      sectionIndex,
      brandId,
      organisationId,
      tenant!,
      input.action,
    );
    return apiSuccess(result, { requestId });
  });
}
