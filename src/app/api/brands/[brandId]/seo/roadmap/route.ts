import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withTopicsManage, withTopicsRead } from "@/lib/api/topics-handler";
import { updateRoadmapSchema } from "@/lib/validation/topics";
import { seoContentRoadmapService } from "@/server/services/seo-content-roadmap-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await seoContentRoadmapService.listRoadmap(brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateRoadmapSchema, body);
    const item = await seoContentRoadmapService.transitionStatus(brandId, organisationId, input, tenant!);
    return apiSuccess({ item }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json();

  if (action === "link-content") {
    return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
      const item = await seoContentRoadmapService.linkToContent(brandId, organisationId, body, tenant!);
      return apiSuccess({ item }, { requestId });
    });
  }

  return withTopicsRead(request, organisationId, async ({ requestId }) =>
    apiSuccess({ error: "Unknown action" }, { requestId }),
  );
}
