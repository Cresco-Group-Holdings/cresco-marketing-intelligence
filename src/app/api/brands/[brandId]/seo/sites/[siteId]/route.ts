import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withSeoSitesManage,
  withSeoSitesRead,
} from "@/lib/api/seo-handler";
import { parseBody } from "@/lib/api/handler";
import { updateSeoSiteSchema } from "@/lib/validation/seo";
import { seoSiteService } from "@/server/services/seo-site-service";

type Params = { params: Promise<{ brandId: string; siteId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { site: await seoSiteService.getById(siteId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withSeoSitesManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateSeoSiteSchema, body);
    const site = await seoSiteService.update(siteId, brandId, organisationId, input, tenant!);
    return apiSuccess({ site }, { requestId });
  });
}
