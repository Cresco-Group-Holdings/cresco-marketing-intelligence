import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withAnalyticsSync } from "@/lib/api/analytics-handler";
import { socialAnalyticsSyncSchema } from "@/lib/validation/social-analytics";
import { socialAnalyticsSyncService } from "@/server/services/social-analytics-sync-service";
type Params = { params: Promise<{ brandId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(socialAnalyticsSyncSchema, await jsonBody(request));
  return withAnalyticsSync(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        sync: await socialAnalyticsSyncService.enqueue(
          brandId,
          organisationId,
          {
            ...body,
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
          },
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
