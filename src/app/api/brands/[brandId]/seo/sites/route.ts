import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withSeoSitesCreate,
  withSeoSitesRead,
} from "@/lib/api/seo-handler";
import { parseBody } from "@/lib/api/handler";
import { createSeoSiteSchema } from "@/lib/validation/seo";
import { seoSiteService } from "@/server/services/seo-site-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { items: await seoSiteService.list(brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withSeoSitesCreate(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createSeoSiteSchema, body);
    const site = await seoSiteService.create(brandId, organisationId, input, tenant!);
    return apiSuccess({ site }, { requestId });
  });
}
