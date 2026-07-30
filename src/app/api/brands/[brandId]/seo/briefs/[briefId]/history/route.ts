import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withBriefsRead } from "@/lib/api/briefs-handler";
import { seoContentBriefService } from "@/server/services/seo-content-brief-service";

type Params = { params: Promise<{ brandId: string; briefId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, briefId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBriefsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await seoContentBriefService.getHistory(briefId, brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}
