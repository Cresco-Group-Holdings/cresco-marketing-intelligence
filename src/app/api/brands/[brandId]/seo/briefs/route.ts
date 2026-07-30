import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withBriefsManage, withBriefsRead } from "@/lib/api/briefs-handler";
import { createBriefSchema } from "@/lib/validation/briefs";
import { seoContentBriefService } from "@/server/services/seo-content-brief-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  return withBriefsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ items: await seoContentBriefService.list(brandId, organisationId, tenant!, { status }) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withBriefsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createBriefSchema, body);
    const brief = await seoContentBriefService.create(brandId, organisationId, input, tenant!);
    return apiSuccess({ brief }, { requestId });
  });
}
