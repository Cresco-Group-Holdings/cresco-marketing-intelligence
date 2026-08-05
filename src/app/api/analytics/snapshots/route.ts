import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withAnalyticsRead,
} from "@/lib/api/analytics-core-handler";
import { analyticsSnapshotCreateSchema } from "@/lib/validation/analytics-core";
import { analyticsSnapshotService } from "@/server/services/analytics-snapshot-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const campaignId = request.nextUrl.searchParams.get("campaignId") ?? undefined;

  return withAnalyticsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { snapshots: await analyticsSnapshotService.listSnapshots(organisationId, tenant!, campaignId) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = parseBody(analyticsSnapshotCreateSchema, await jsonBody(request));

  return withAnalyticsRead(request, organisationId, async ({ requestId, tenant, user }) =>
    apiSuccess(
      {
        snapshot: await analyticsSnapshotService.createSnapshot(
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
