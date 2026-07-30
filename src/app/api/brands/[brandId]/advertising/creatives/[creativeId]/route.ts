import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingCreativesApprove,
  withAdvertisingCreativesEdit,
  withAdvertisingCreativesGenerate,
  withAdvertisingCreativesRead,
  withAdvertisingCreativesReview,
} from "@/lib/api/advertising-creatives-handler";
import {
  addVariantSchema,
  attachAssetSchema,
  generateCopySchema,
  reviewDecisionSchema,
  updateCopySchema,
  validateProviderSchema,
} from "@/lib/validation/advertising-creatives";
import { advertisingCreativeAiService } from "@/server/services/advertising-creative-ai-service";
import { advertisingCreativeProjectService } from "@/server/services/advertising-creative-project-service";
import { advertisingCreativeReviewService } from "@/server/services/advertising-creative-review-service";

type Params = { params: Promise<{ brandId: string; creativeId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, creativeId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingCreativesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { project: await advertisingCreativeProjectService.getById(creativeId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, creativeId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const action = body.action as string;

  if (action === "generate-concepts") {
    return withAdvertisingCreativesGenerate(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingCreativeAiService.generateConcepts(creativeId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  if (action === "generate-copy") {
    return withAdvertisingCreativesGenerate(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(generateCopySchema, body);
      const result = await advertisingCreativeAiService.generateCopy(
        creativeId, brandId, organisationId, input.formatType, tenant!,
      );
      return apiSuccess(result, { requestId });
    });
  }

  if (action === "add-variant") {
    return withAdvertisingCreativesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addVariantSchema, body);
      const variant = await advertisingCreativeProjectService.addVariant(creativeId, brandId, organisationId, input, tenant!);
      return apiSuccess({ variant }, { requestId });
    });
  }

  if (action === "update-copy") {
    return withAdvertisingCreativesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(updateCopySchema, body);
      const copy = await advertisingCreativeProjectService.upsertCopy(creativeId, brandId, organisationId, input, tenant!);
      return apiSuccess({ copy }, { requestId });
    });
  }

  if (action === "attach-asset") {
    return withAdvertisingCreativesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(attachAssetSchema, body);
      const asset = await advertisingCreativeProjectService.attachAsset(creativeId, brandId, organisationId, input, tenant!);
      return apiSuccess({ asset }, { requestId });
    });
  }

  if (action === "validate-provider") {
    return withAdvertisingCreativesRead(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(validateProviderSchema, body);
      const result = await advertisingCreativeAiService.runProviderValidation(
        creativeId, brandId, organisationId, input.provider, input.formatType, tenant!,
      );
      return apiSuccess(result, { requestId });
    });
  }

  if (action === "submit-review") {
    return withAdvertisingCreativesReview(request, organisationId, async ({ requestId, tenant }) => {
      const project = await advertisingCreativeReviewService.submitForReview(creativeId, brandId, organisationId, tenant!);
      return apiSuccess({ project }, { requestId });
    });
  }

  if (action === "review") {
    return withAdvertisingCreativesApprove(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(reviewDecisionSchema, body);
      const review = await advertisingCreativeReviewService.decide(creativeId, brandId, organisationId, input, tenant!);
      return apiSuccess({ review }, { requestId });
    });
  }

  if (action === "create-version") {
    return withAdvertisingCreativesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const version = await advertisingCreativeProjectService.createVersion(
        creativeId, brandId, organisationId, tenant!, body.changeNote,
      );
      return apiSuccess({ version }, { requestId });
    });
  }

  if (action === "lock-copy") {
    return withAdvertisingCreativesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const copy = await advertisingCreativeReviewService.lockCopyField(
        creativeId, brandId, organisationId, body.copyId, tenant!,
      );
      return apiSuccess({ copy }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${action}`);
}
