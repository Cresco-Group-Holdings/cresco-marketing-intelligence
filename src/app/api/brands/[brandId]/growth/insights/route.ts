import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withGrowthRead } from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const dataStatus = request.nextUrl.searchParams.get("dataStatus") as
    | "SUFFICIENT"
    | "INSUFFICIENT"
    | null;

  return withGrowthRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthIntelligenceService.listInsights(brandId, tenant!.organisationId, tenant!, {
        dataStatus: dataStatus ?? undefined,
      }),
      { requestId },
    ),
  );
}
