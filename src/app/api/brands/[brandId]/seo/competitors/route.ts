import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCompetitorsManage,
  withCompetitorsRead,
} from "@/lib/api/competitors-handler";
import {
  competitorListFiltersSchema,
  createCompetitorSchema,
} from "@/lib/validation/competitors";
import { seoCompetitorService } from "@/server/services/seo-competitor-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = parseBody(
    competitorListFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  return withCompetitorsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { items: await seoCompetitorService.list(brandId, organisationId, filters, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withCompetitorsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createCompetitorSchema, body);
    const competitor = await seoCompetitorService.create(brandId, organisationId, input, tenant!);
    return apiSuccess({ competitor }, { requestId });
  });
}
