import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentEdit,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentUpdateSchema } from "@/lib/validation/content";
import { contentService } from "@/server/services/content-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentService.getById(brandId, organisationId, contentId, tenant!);
    return apiSuccess({ item }, { requestId });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentUpdateSchema, await jsonBody(request));

  return withContentEdit(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentService.update(
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
