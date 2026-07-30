import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withContentRefreshManage,
  withContentRefreshRead,
} from "@/lib/api/rank-tracking-handler";
import { convertRefreshSchema } from "@/lib/validation/rank-tracking";
import { seoContentRefreshService } from "@/server/services/seo-content-refresh-service";

type Params = { params: Promise<{ brandId: string; candidateId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, candidateId } = await params;
  const organisationId = requireOrganisationId(request);
  return withContentRefreshRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { candidate: await seoContentRefreshService.getCandidate(candidateId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, candidateId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withContentRefreshManage(request, organisationId, async ({ requestId, tenant, user }) => {
    if (!user?.userProfileId) throw new AppError("UNAUTHORIZED", "Authentication required.");
    const input = parseBody(convertRefreshSchema, body);
    const outcome = await seoContentRefreshService.convertToWorkflow(
      candidateId,
      input.recommendationId,
      input.workflowType,
      brandId,
      organisationId,
      user.userProfileId,
      tenant!,
    );
    return apiSuccess({ outcome }, { requestId });
  });
}
