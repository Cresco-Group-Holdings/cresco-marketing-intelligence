import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  analyticsAttributionFilters,
  requireOrganisationId,
  withAnalyticsRead,
} from "@/lib/api/analytics-handler";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
type Params = { params: Promise<{ brandId: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const { filters, dimension } = analyticsAttributionFilters(request);
  return withAnalyticsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await socialAnalyticsQueryService.attribution(
        brandId,
        organisationId,
        filters,
        dimension,
        tenant!,
      ),
      { requestId },
    ),
  );
}
