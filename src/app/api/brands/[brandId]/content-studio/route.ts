import { ContentStatus, ContentStudioType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentCreate,
  withContentGenerate,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentStudioCreateSchema, contentStudioGenerateBriefSchema } from "@/lib/validation/content-studio";
import { contentStudioBriefAiService } from "@/server/services/content-studio-brief-ai-service";
import { contentStudioService } from "@/server/services/content-studio-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const status = request.nextUrl.searchParams.get("status");
  const studioType = request.nextUrl.searchParams.get("studioType");
  const ownerUserId = request.nextUrl.searchParams.get("ownerUserId") ?? undefined;
  const campaignId = request.nextUrl.searchParams.get("campaignId") ?? undefined;
  const search = request.nextUrl.searchParams.get("search") ?? undefined;

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const items = await contentStudioService.list(brandId, organisationId, tenant!, {
      status: status ? (status as ContentStatus) : undefined,
      studioType: studioType ? (studioType as ContentStudioType) : undefined,
      ownerUserId,
      campaignId,
      search,
    });
    return apiSuccess({ items }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");

  if (action === "generate-brief") {
    const body = parseBody(contentStudioGenerateBriefSchema, await jsonBody(request));
    return withContentGenerate(request, organisationId, async ({ requestId, tenant }) => {
      const result = await contentStudioBriefAiService.createAndGenerateBrief(
        brandId,
        organisationId,
        body,
        tenant!,
        requestId,
      );
      return apiSuccess(result, { requestId });
    });
  }

  const body = parseBody(contentStudioCreateSchema, await jsonBody(request));

  return withContentCreate(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentStudioService.create(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
