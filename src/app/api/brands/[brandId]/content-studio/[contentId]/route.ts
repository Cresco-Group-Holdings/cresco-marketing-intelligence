import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentEdit,
  withContentRead,
} from "@/lib/api/content-handler";
import {
  contentStudioTransitionSchema,
  contentStudioUpdateSchema,
} from "@/lib/validation/content-studio";
import { contentStudioService } from "@/server/services/content-studio-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentStudioService.getById(
      brandId,
      organisationId,
      contentId,
      tenant!,
    );
    return apiSuccess({ item }, { requestId });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentStudioUpdateSchema, await jsonBody(request));

  return withContentEdit(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentStudioService.update(
      brandId,
      organisationId,
      contentId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentStudioTransitionSchema, await jsonBody(request));

  return withContentEdit(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentStudioService.transition(
      brandId,
      organisationId,
      contentId,
      body.toStatus,
      tenant!,
      body.reason,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
