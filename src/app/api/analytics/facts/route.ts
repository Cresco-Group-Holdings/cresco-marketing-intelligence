import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  analyticsFactQuery,
  requireOrganisationId,
  withAnalyticsRead,
} from "@/lib/api/analytics-core-handler";
import { analyticsCoreService } from "@/server/services/analytics-core-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = analyticsFactQuery(request);

  return withAnalyticsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        facts: await analyticsCoreService.queryFacts(organisationId, filters, tenant!),
        aggregates: await analyticsCoreService.aggregateMetrics(organisationId, filters, tenant!),
      },
      { requestId },
    ),
  );
}
