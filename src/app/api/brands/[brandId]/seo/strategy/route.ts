import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withTopicsManage,
  withTopicsRead,
  withTopicsStrategy,
} from "@/lib/api/topics-handler";
import {
  createPillarSchema,
  createStrategySchema,
  createSupportingSchema,
} from "@/lib/validation/topics";
import { seoContentStrategyService } from "@/server/services/seo-content-strategy-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { items: await seoContentStrategyService.listStrategies(brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json();

  if (action === "pillar") {
    return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(createPillarSchema, body);
      const pillar = await seoContentStrategyService.createPillar(brandId, organisationId, input, tenant!);
      return apiSuccess({ pillar }, { requestId });
    });
  }

  if (action === "supporting") {
    return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(createSupportingSchema, body);
      const supporting = await seoContentStrategyService.createSupporting(brandId, organisationId, input, tenant!);
      return apiSuccess({ supporting }, { requestId });
    });
  }

  return withTopicsStrategy(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createStrategySchema, body);
    const result = await seoContentStrategyService.createStrategy(brandId, organisationId, input, tenant!);
    return apiSuccess(result, { requestId });
  });
}
