import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { knowledgeBaseService } from "@/server/services";
import {
  knowledgeEntryApprovalSchema,
  knowledgeEntryRejectSchema,
  knowledgeEntryUpdateSchema,
} from "@/lib/validation/knowledge-base";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withKnowledgeBaseRead,
  withKnowledgeBaseWrite,
  type BrandKbEntryParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandKbEntryParams) {
  const { brandId, knowledgeBaseId, entryId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const entry = await knowledgeBaseService.entries.getById(
      brandId,
      organisationId,
      knowledgeBaseId,
      entryId,
      tenant!,
    );
    return apiSuccess({ entry });
  });
}

export async function PUT(request: NextRequest, { params }: BrandKbEntryParams) {
  const { brandId, knowledgeBaseId, entryId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(knowledgeEntryUpdateSchema, await jsonBody(request));
    const entry = await knowledgeBaseService.entries.update(
      brandId,
      organisationId,
      knowledgeBaseId,
      entryId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ entry }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: BrandKbEntryParams) {
  const { brandId, knowledgeBaseId, entryId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = new URL(request.url).searchParams.get("action");

  return withKnowledgeBaseWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    if (action === "submit") {
      const entry = await knowledgeBaseService.entries.submitForReview(
        brandId,
        organisationId,
        knowledgeBaseId,
        entryId,
        tenant!,
        requestId,
      );
      return apiSuccess({ entry }, { requestId });
    }

    if (action === "approve") {
      const body = parseBody(knowledgeEntryApprovalSchema, await jsonBody(request).catch(() => ({})));
      const entry = await knowledgeBaseService.entries.approve(
        brandId,
        organisationId,
        knowledgeBaseId,
        entryId,
        tenant!,
        requestId,
        body.note,
      );
      return apiSuccess({ entry }, { requestId });
    }

    if (action === "reject") {
      const body = parseBody(knowledgeEntryRejectSchema, await jsonBody(request));
      const entry = await knowledgeBaseService.entries.reject(
        brandId,
        organisationId,
        knowledgeBaseId,
        entryId,
        body.reason,
        tenant!,
        requestId,
      );
      return apiSuccess({ entry }, { requestId });
    }

    if (action === "archive") {
      const entry = await knowledgeBaseService.entries.archive(
        brandId,
        organisationId,
        knowledgeBaseId,
        entryId,
        tenant!,
        requestId,
      );
      return apiSuccess({ entry }, { requestId });
    }

    if (action === "restore") {
      const entry = await knowledgeBaseService.entries.restore(
        brandId,
        organisationId,
        knowledgeBaseId,
        entryId,
        tenant!,
        requestId,
      );
      return apiSuccess({ entry }, { requestId });
    }

    throw new AppError("VALIDATION_ERROR", "Unknown action. Use submit, approve, reject, archive, or restore.");
  });
}
