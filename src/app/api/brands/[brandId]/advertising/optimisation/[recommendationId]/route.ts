import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingOptimisationApprove,
  withAdvertisingOptimisationFeedback,
  withAdvertisingOptimisationRead,
} from "@/lib/api/advertising-optimisation-handler";
import { advertisingOptimisationService } from "@/server/services/advertising-optimisation-service";

type Params = { params: Promise<{ brandId: string; recommendationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, recommendationId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingOptimisationRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { recommendation: await advertisingOptimisationService.getRecommendation(recommendationId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, recommendationId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "approveAction":
      return withAdvertisingOptimisationApprove(request, organisationId, async ({ requestId, tenant }) => {
        const proposal = await advertisingOptimisationService.approveAction(
          body.actionProposalId,
          brandId,
          organisationId,
          body.notes,
          tenant!,
        );
        return apiSuccess({ proposal }, { requestId });
      });

    case "submitFeedback":
      return withAdvertisingOptimisationFeedback(request, organisationId, async ({ requestId, tenant }) => {
        const feedback = await advertisingOptimisationService.submitFeedback(
          recommendationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ feedback }, { requestId });
      });

    case "recordOutcome":
      return withAdvertisingOptimisationFeedback(request, organisationId, async ({ requestId, tenant }) => {
        const outcome = await advertisingOptimisationService.recordOutcome(
          recommendationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ outcome }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
