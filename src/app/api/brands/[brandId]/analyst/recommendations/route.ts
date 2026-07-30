import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { marketingAnalystService } from "@/server/services/marketing-analyst-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const recommendations = await marketingAnalystService.listRecommendations(
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ recommendations }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["ai.analyst.read"] },
  );
}
