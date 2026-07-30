import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withRankTrackingManage,
  withRankTrackingRead,
} from "@/lib/api/rank-tracking-handler";
import { createRankProjectSchema } from "@/lib/validation/rank-tracking";
import { seoRankTrackingService } from "@/server/services/seo-rank-tracking-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withRankTrackingRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ items: await seoRankTrackingService.listProjects(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withRankTrackingManage(request, organisationId, async ({ requestId, tenant, user }) => {
    if (!user?.userProfileId) throw new AppError("UNAUTHORIZED", "Authentication required.");
    const input = parseBody(createRankProjectSchema, body);
    const project = await seoRankTrackingService.createProject(
      brandId,
      organisationId,
      user.userProfileId,
      input,
      tenant!,
    );
    return apiSuccess({ project }, { requestId });
  });
}
