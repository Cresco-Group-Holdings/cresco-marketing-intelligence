import { NextRequest } from "next/server";
import { createRequestId, apiSuccess, handleApiError } from "@/lib/api/response";
import { getIntegrationStatus, getServerEnv } from "@/lib/environment";
import { requireCurrentOrganisationContext } from "@/lib/tenancy/context";
import { withTenantContext } from "@/lib/tenancy/guards";
import { organisationService } from "@/server/services";

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const organisationId = request.nextUrl.searchParams.get("organisationId");
    if (!organisationId) {
      return apiSuccess(
        {
          integrations: getIntegrationStatus(getServerEnv()),
        },
        { requestId },
      );
    }

    const organisations = await withTenantContext({ organisationId }, async () => {
      const context = requireCurrentOrganisationContext();
      return organisationService.getAccessibleOrganisations(context);
    });

    return apiSuccess({ organisations }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
