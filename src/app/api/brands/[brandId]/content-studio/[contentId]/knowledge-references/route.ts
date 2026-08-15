import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentEdit,
} from "@/lib/api/content-handler";
import { contentStudioKnowledgeRefSchema } from "@/lib/validation/content-studio";
import { contentStudioService } from "@/server/services/content-studio-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentStudioKnowledgeRefSchema, await jsonBody(request));

  return withContentEdit(request, organisationId, async ({ requestId, tenant }) => {
    const reference = await contentStudioService.addKnowledgeReference(
      brandId,
      organisationId,
      contentId,
      body,
      tenant!,
    );
    return apiSuccess({ reference }, { requestId });
  });
}
