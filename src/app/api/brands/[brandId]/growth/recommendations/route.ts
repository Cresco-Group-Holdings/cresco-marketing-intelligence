import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withGrowthRead } from "@/lib/api/growth-handler";
import { growthRecommendationService } from "@/server/services/growth-recommendation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const status = (request.nextUrl.searchParams.get("status") ?? "ACTIVE") as
    | "ACTIVE"
    | "EXPIRED"
    | "SUPERSEDED"
    | "ALL";

  return withGrowthRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthRecommendationService.list(brandId, organisationId, tenant!, status),
      { requestId },
    ),
  );
}
