import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { marketingAnalystService } from "@/server/services/marketing-analyst-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; recommendationId: string }> },
) {
  const { brandId, recommendationId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  const action = request.nextUrl.searchParams.get("action");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      if (action === "dismiss") {
        const recommendation = await marketingAnalystService.dismissRecommendation(
          brandId,
          organisationId,
          recommendationId,
          tenant!,
        );
        return apiSuccess({ recommendation }, { requestId });
      }

      if (action === "create") {
        const recommendation = await marketingAnalystService.createActionFromRecommendation(
          brandId,
          organisationId,
          recommendationId,
          tenant!,
          requestId,
        );
        return apiSuccess({ recommendation }, { requestId });
      }

      return apiSuccess({ error: "invalid_action" });
    },
    { organisationId, permission: PERMISSIONS["ai.analyst.generate"] },
  );
}
