import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withGrowthRead } from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const dataStatus = request.nextUrl.searchParams.get("dataStatus") as
    | "SUFFICIENT"
    | "INSUFFICIENT"
    | null;

  return withGrowthRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthIntelligenceService.listInsights(brandId, organisationId, tenant!, {
        dataStatus: dataStatus ?? undefined,
      }),
      { requestId },
    ),
  );
}
