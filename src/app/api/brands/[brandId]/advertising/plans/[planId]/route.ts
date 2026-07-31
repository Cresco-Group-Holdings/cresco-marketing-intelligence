import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingPlansApproveBudget,
  withAdvertisingPlansApproveCompliance,
  withAdvertisingPlansApproveCreative,
  withAdvertisingPlansApproveLaunch,
  withAdvertisingPlansApproveStrategy,
  withAdvertisingPlansEdit,
  withAdvertisingPlansRead,
} from "@/lib/api/advertising-plans-handler";
import {
  addAudienceSchema,
  addBudgetSchema,
  addChannelSchema,
  addConversionGoalSchema,
  addDestinationSchema,
  approvalActionSchema,
} from "@/lib/validation/advertising-plans";
import { advertisingCampaignApprovalService } from "@/server/services/advertising-campaign-approval-service";
import { advertisingCampaignPlanAiService } from "@/server/services/advertising-campaign-plan-ai-service";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";
import { advertisingCampaignReadinessService } from "@/server/services/advertising-campaign-readiness-service";

type Params = { params: Promise<{ brandId: string; planId: string }> };

const APPROVE_HANDLERS: Record<string, typeof withAdvertisingPlansApproveStrategy> = {
  STRATEGY: withAdvertisingPlansApproveStrategy,
  BUDGET: withAdvertisingPlansApproveBudget,
  AUDIENCE: withAdvertisingPlansApproveStrategy,
  CREATIVE: withAdvertisingPlansApproveCreative,
  COMPLIANCE: withAdvertisingPlansApproveCompliance,
  LAUNCH: withAdvertisingPlansApproveLaunch,
};

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, planId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingPlansRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { plan: await advertisingCampaignPlanService.getById(planId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, planId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const action = body.action as string;

  if (action === "generate") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingCampaignPlanAiService.generatePlan(planId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  if (action === "readiness") {
    return withAdvertisingPlansRead(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingCampaignReadinessService.runChecks(planId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  if (action === "add-channel") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addChannelSchema, body);
      const channel = await advertisingCampaignPlanService.addChannel(planId, brandId, organisationId, input, tenant!);
      return apiSuccess({ channel }, { requestId });
    });
  }

  if (action === "add-budget") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addBudgetSchema, body);
      const budget = await advertisingCampaignPlanService.addBudget(planId, brandId, organisationId, input, tenant!);
      return apiSuccess({ budget }, { requestId });
    });
  }

  if (action === "add-audience") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addAudienceSchema, body);
      const audience = await advertisingCampaignPlanService.addAudience(planId, brandId, organisationId, input, tenant!);
      return apiSuccess({ audience }, { requestId });
    });
  }

  if (action === "add-conversion") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addConversionGoalSchema, body);
      const goal = await advertisingCampaignPlanService.addConversionGoal(planId, brandId, organisationId, input, tenant!);
      return apiSuccess({ goal }, { requestId });
    });
  }

  if (action === "add-destination") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addDestinationSchema, body);
      const destination = await advertisingCampaignPlanService.addDestination(planId, brandId, organisationId, input, tenant!);
      return apiSuccess({ destination }, { requestId });
    });
  }

  if (action === "attach-creative") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const creative = await advertisingCampaignPlanService.attachCreative(planId, brandId, organisationId, body, tenant!);
      return apiSuccess({ creative }, { requestId });
    });
  }

  if (action === "request-approval") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const approval = await advertisingCampaignApprovalService.requestApproval(
        planId, brandId, organisationId, body.approvalType, tenant!,
      );
      return apiSuccess({ approval }, { requestId });
    });
  }

  if (action === "approve") {
    const input = parseBody(approvalActionSchema, body);
    const handler = APPROVE_HANDLERS[input.approvalType] ?? withAdvertisingPlansApproveStrategy;
    return handler(request, organisationId, async ({ requestId, tenant }) => {
      const plan = await advertisingCampaignApprovalService.decide(planId, brandId, organisationId, input, tenant!);
      return apiSuccess({ plan }, { requestId });
    });
  }

  if (action === "submit-review") {
    return withAdvertisingPlansEdit(request, organisationId, async ({ requestId, tenant }) => {
      const plan = await advertisingCampaignPlanService.updateStatus(planId, brandId, organisationId, "READY_FOR_REVIEW", tenant!);
      return apiSuccess({ plan }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${action}`);
}
