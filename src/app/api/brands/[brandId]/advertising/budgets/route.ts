import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingBudgetsManage,
  withAdvertisingBudgetsRead,
  withAdvertisingBudgetsRequest,
} from "@/lib/api/advertising-budget-governance-handler";
import { advertisingBudgetGovernanceService } from "@/server/services/advertising-budget-governance-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingBudgetsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ dashboard: await advertisingBudgetGovernanceService.getDashboard(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createPolicy":
      return withAdvertisingBudgetsManage(request, organisationId, async ({ requestId, tenant }) => {
        const policy = await advertisingBudgetGovernanceService.createPolicy(brandId, organisationId, body, tenant!);
        return apiSuccess({ policy }, { requestId });
      });

    case "computePacing":
      return withAdvertisingBudgetsRead(request, organisationId, async ({ requestId, tenant }) => {
        const result = await advertisingBudgetGovernanceService.computePacing(brandId, organisationId, body, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "createChangeRequest":
      return withAdvertisingBudgetsRequest(request, organisationId, async ({ requestId, tenant }) => {
        const changeRequest = await advertisingBudgetGovernanceService.createChangeRequest(brandId, organisationId, body, tenant!);
        return apiSuccess({ changeRequest }, { requestId });
      });

    case "recordObservation":
      return withAdvertisingBudgetsManage(request, organisationId, async ({ requestId, tenant }) => {
        const observation = await advertisingBudgetGovernanceService.recordObservation(brandId, organisationId, body, tenant!);
        return apiSuccess({ observation }, { requestId });
      });

    case "aggregateSpend":
      return withAdvertisingBudgetsRead(request, organisationId, async ({ requestId, tenant }) => {
        const aggregate = await advertisingBudgetGovernanceService.aggregateSpend(
          brandId,
          organisationId,
          body.reportingCurrency,
          body.fxRates ?? [],
          tenant!,
        );
        return apiSuccess({ aggregate }, { requestId });
      });

    case "aiRecommendation":
      return withAdvertisingBudgetsRead(request, organisationId, async ({ requestId, tenant }) => {
        const recommendation = await advertisingBudgetGovernanceService.createAiRecommendation(brandId, organisationId, body, tenant!);
        return apiSuccess({ recommendation }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
