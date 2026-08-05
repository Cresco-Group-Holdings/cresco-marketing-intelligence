import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  analyticsDashboardFilters,
  requireOrganisationId,
  withAnalyticsRead,
} from "@/lib/api/analytics-core-handler";
import { analyticsDashboardService } from "@/server/services/analytics-dashboard-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = analyticsDashboardFilters(request);

  return withAnalyticsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await analyticsDashboardService.getChannelPerformance(organisationId, filters, tenant!),
      { requestId },
    ),
  );
}
