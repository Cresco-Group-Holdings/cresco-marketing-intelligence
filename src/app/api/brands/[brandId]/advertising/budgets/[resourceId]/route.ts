import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingBudgetsApprove,
  withAdvertisingBudgetsEmergency,
  withAdvertisingBudgetsRead,
} from "@/lib/api/advertising-budget-governance-handler";
import { advertisingBudgetGovernanceService } from "@/server/services/advertising-budget-governance-service";

type Params = { params: Promise<{ brandId: string; resourceId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, resourceId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "approveChangeRequest":
      return withAdvertisingBudgetsApprove(request, organisationId, async ({ requestId, tenant }) => {
        const changeRequest = await advertisingBudgetGovernanceService.approveChangeRequest(
          resourceId,
          brandId,
          organisationId,
          body.notes,
          tenant!,
        );
        return apiSuccess({ changeRequest }, { requestId });
      });

    case "rejectChangeRequest":
      return withAdvertisingBudgetsApprove(request, organisationId, async ({ requestId, tenant }) => {
        const changeRequest = await advertisingBudgetGovernanceService.rejectChangeRequest(
          resourceId,
          brandId,
          organisationId,
          body.notes,
          tenant!,
        );
        return apiSuccess({ changeRequest }, { requestId });
      });

    case "acknowledgeAlert":
      return withAdvertisingBudgetsRead(request, organisationId, async ({ requestId, tenant }) => {
        const alert = await advertisingBudgetGovernanceService.acknowledgeAlert(resourceId, brandId, organisationId, tenant!);
        return apiSuccess({ alert }, { requestId });
      });

    case "triggerEmergency":
      return withAdvertisingBudgetsEmergency(request, organisationId, async ({ requestId, tenant }) => {
        const incident = await advertisingBudgetGovernanceService.triggerEmergency(brandId, organisationId, body, tenant!);
        return apiSuccess({ incident }, { requestId });
      });

    case "resolveIncident":
      return withAdvertisingBudgetsEmergency(request, organisationId, async ({ requestId, tenant }) => {
        const incident = await advertisingBudgetGovernanceService.resolveIncident(
          resourceId,
          brandId,
          organisationId,
          body.restorationApproved ?? false,
          tenant!,
        );
        return apiSuccess({ incident }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
