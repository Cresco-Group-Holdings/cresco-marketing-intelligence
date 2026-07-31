import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withLongFormGenerate,
  withLongFormManage,
  withLongFormRead,
  withLongFormReview,
} from "@/lib/api/long-form-handler";
import {
  confirmOutlineSchema,
  reviewDecisionSchema,
  updateLongFormDocumentSchema,
} from "@/lib/validation/long-form";
import { longFormDocumentService } from "@/server/services/long-form-document-service";
import { longFormGenerationService } from "@/server/services/long-form-generation-service";
import { longFormReviewService } from "@/server/services/long-form-review-service";

type Params = { params: Promise<{ brandId: string; documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, documentId } = await params;
  const organisationId = requireOrganisationId(request);
  return withLongFormRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { document: await longFormDocumentService.getById(documentId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, documentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withLongFormManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateLongFormDocumentSchema, body);
    const document = await longFormDocumentService.update(documentId, brandId, organisationId, input, tenant!);
    return apiSuccess({ document }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, documentId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json().catch(() => ({}));

  if (action === "generate-outline") {
    return withLongFormGenerate(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        await longFormGenerationService.generateOutline(documentId, brandId, organisationId, tenant!),
        { requestId },
      ),
    );
  }

  if (action === "confirm-outline") {
    return withLongFormManage(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(confirmOutlineSchema, body);
      const document = await longFormGenerationService.confirmOutline(
        documentId,
        brandId,
        organisationId,
        input.confirmed,
        tenant!,
        input.changeNote,
      );
      return apiSuccess({ document }, { requestId });
    });
  }

  if (action === "generate-sections") {
    return withLongFormGenerate(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        {
          document: await longFormGenerationService.generateAllSections(
            documentId,
            brandId,
            organisationId,
            tenant!,
          ),
        },
        { requestId },
      ),
    );
  }

  if (action === "submit-review") {
    return withLongFormManage(request, organisationId, async ({ requestId, tenant }) => {
      const stage = (body as { stage?: string }).stage ?? "EVIDENCE";
      const document = await longFormReviewService.submitStage(
        documentId,
        brandId,
        organisationId,
        stage as "OUTLINE" | "EVIDENCE" | "SEO" | "COMPLIANCE" | "FINAL",
        tenant!,
      );
      return apiSuccess({ document }, { requestId });
    });
  }

  if (action === "review-decide") {
    return withLongFormReview(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(reviewDecisionSchema, body);
      const document = await longFormReviewService.decide(documentId, brandId, organisationId, input, tenant!);
      return apiSuccess({ document }, { requestId });
    });
  }

  if (action === "seo-assistance") {
    return withLongFormRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        {
          report: await longFormGenerationService.buildSeoSnapshot(
            documentId,
            brandId,
            organisationId,
            tenant!,
          ),
        },
        { requestId },
      ),
    );
  }

  return withLongFormRead(request, organisationId, async ({ requestId }) =>
    apiSuccess({ error: "Unknown action" }, { requestId }),
  );
}
