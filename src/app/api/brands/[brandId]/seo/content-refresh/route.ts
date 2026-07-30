import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withContentRefreshRead } from "@/lib/api/rank-tracking-handler";
import { seoContentRefreshService } from "@/server/services/seo-content-refresh-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
  return withContentRefreshRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { candidates: await seoContentRefreshService.listCandidates(brandId, organisationId, tenant!, projectId) },
      { requestId },
    ),
  );
}
