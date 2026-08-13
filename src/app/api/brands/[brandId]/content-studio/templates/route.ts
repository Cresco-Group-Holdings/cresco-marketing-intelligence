import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentCreate,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentStudioTemplateCreateSchema } from "@/lib/validation/content-studio";
import { contentStudioService } from "@/server/services/content-studio-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const templates = await contentStudioService.listTemplates(
      brandId,
      organisationId,
      tenant!,
    );
    return apiSuccess({ templates }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentStudioTemplateCreateSchema, await jsonBody(request));

  return withContentCreate(request, organisationId, async ({ requestId, tenant }) => {
    const template = await contentStudioService.createTemplate(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ template }, { requestId });
  });
}
