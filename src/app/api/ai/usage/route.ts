import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler, getOrganisationIdFromRequest } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { hasConfiguredAiProvider } from "@/lib/ai/model-registry";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { listConfiguredProviders } from "@/lib/ai/providers";
import { getOrganisationUsageDashboard } from "@/server/services/ai-usage-recorder";
import { getUsageSummary } from "@/lib/ai/cost-controls";

export async function GET(request: NextRequest) {
  const organisationId =
    getOrganisationIdFromRequest(request) ??
    request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const [dashboard, summary] = await Promise.all([
        getOrganisationUsageDashboard(organisationId),
        getUsageSummary(organisationId, tenant!.userProfileId),
      ]);

      return apiSuccess(
        {
          dashboard,
          summary,
          providerStatus: listConfiguredProviders().filter((entry) => entry.provider !== "MOCK"),
          aiConfigured: hasConfiguredAiProvider(),
        },
        { requestId },
      );
    },
    { organisationId, permission: PERMISSIONS["ai.usage.read"] },
  );
}
