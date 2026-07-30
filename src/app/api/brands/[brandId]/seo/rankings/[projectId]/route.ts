import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withRankTrackingImport,
  withRankTrackingManage,
  withRankTrackingRead,
} from "@/lib/api/rank-tracking-handler";
import { addTrackedKeywordSchema, importObservationsSchema } from "@/lib/validation/rank-tracking";
import { seoContentRefreshService } from "@/server/services/seo-content-refresh-service";
import { seoRankObservationService } from "@/server/services/seo-rank-observation-service";
import { seoRankTrackingService } from "@/server/services/seo-rank-tracking-service";

type Params = { params: Promise<{ brandId: string; projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, projectId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");

  if (action === "changes") {
    return withRankTrackingRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        { changes: await seoRankTrackingService.listRankChanges(projectId, brandId, organisationId, tenant!) },
        { requestId },
      ),
    );
  }

  if (action === "pages") {
    return withRankTrackingRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        { pages: await seoRankTrackingService.listPagesWithRankings(projectId, brandId, organisationId, tenant!) },
        { requestId },
      ),
    );
  }

  return withRankTrackingRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { project: await seoRankTrackingService.getProject(projectId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, projectId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "import") {
    return withRankTrackingImport(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(importObservationsSchema, body);
      const observations = await seoRankObservationService.importObservations(
        brandId,
        organisationId,
        input.trackedKeywordId,
        input.observations,
        tenant!,
      );
      return apiSuccess({ observations }, { requestId });
    });
  }

  if (action === "scan-decay") {
    return withRankTrackingManage(request, organisationId, async ({ requestId, tenant }) => {
      const candidates = await seoContentRefreshService.scanForDecay(projectId, brandId, organisationId, tenant!);
      return apiSuccess({ candidates }, { requestId });
    });
  }

  return withRankTrackingManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(addTrackedKeywordSchema, body);
    const keyword = await seoRankTrackingService.addTrackedKeyword(
      projectId,
      brandId,
      organisationId,
      input,
      tenant!,
    );
    return apiSuccess({ keyword }, { requestId });
  });
}
