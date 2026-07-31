import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCompetitorsManage,
  withCompetitorsRead,
} from "@/lib/api/competitors-handler";
import { updateCompetitorSchema } from "@/lib/validation/competitors";
import { seoCompetitorService } from "@/server/services/seo-competitor-service";

type Params = { params: Promise<{ brandId: string; competitorId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, competitorId } = await params;
  const organisationId = requireOrganisationId(request);
  return withCompetitorsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { competitor: await seoCompetitorService.getById(competitorId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, competitorId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withCompetitorsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateCompetitorSchema, body);
    const competitor = await seoCompetitorService.update(
      competitorId,
      brandId,
      organisationId,
      input,
      tenant!,
    );
    return apiSuccess({ competitor }, { requestId });
  });
}
