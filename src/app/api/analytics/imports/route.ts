import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withAnalyticsImport,
  withAnalyticsRead,
} from "@/lib/api/analytics-core-handler";
import { analyticsManualImportSchema } from "@/lib/validation/analytics-core";
import { analyticsCoreService } from "@/server/services/analytics-core-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = parseBody(analyticsManualImportSchema, await jsonBody(request));

  return withAnalyticsImport(request, organisationId, async ({ requestId, tenant, user }) =>
    apiSuccess(
      {
        batch: await analyticsCoreService.importManualMetrics(
          organisationId,
          body,
          tenant!,
          user.userProfileId,
        ),
      },
      { requestId },
    ),
  );
}

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const batchId = request.nextUrl.searchParams.get("batchId");
  if (!batchId) {
    return withAnalyticsRead(request, organisationId, async ({ requestId }) =>
      apiSuccess({ message: "Provide batchId query parameter." }, { requestId }),
    );
  }

  return withAnalyticsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { batch: await analyticsCoreService.getImportBatch(organisationId, batchId, tenant!) },
      { requestId },
    ),
  );
}
