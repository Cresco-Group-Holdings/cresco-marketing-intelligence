import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withSeoSitesManage,
} from "@/lib/api/seo-handler";
import { parseBody } from "@/lib/api/handler";
import { verifyDomainSchema } from "@/lib/validation/seo";
import { seoSiteService } from "@/server/services/seo-site-service";

type Params = { params: Promise<{ brandId: string; siteId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withSeoSitesManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(verifyDomainSchema, body);
    const result = await seoSiteService.initiateVerification(
      siteId,
      brandId,
      organisationId,
      input.method,
      input.hostname,
      tenant!,
    );
    return apiSuccess({ verification: result }, { requestId });
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const hostname = request.nextUrl.searchParams.get("hostname") ?? undefined;
  return withSeoSitesManage(request, organisationId, async ({ requestId, tenant }) => {
    const result = await seoSiteService.checkVerification(
      siteId,
      brandId,
      organisationId,
      hostname,
      tenant!,
    );
    return apiSuccess({ verification: result }, { requestId });
  });
}
