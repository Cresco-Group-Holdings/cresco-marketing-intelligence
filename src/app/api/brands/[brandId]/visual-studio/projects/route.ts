import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withVisualStudioWrite } from "@/lib/api/visual-studio-handler";
import { visualProjectCreateSchema } from "@/lib/validation/visual-studio";
import { visualStudioService } from "@/server/services/visual-studio-service";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(visualProjectCreateSchema, await jsonBody(request));
  return withVisualStudioWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { project: await visualStudioService.createProject(brandId, organisationId, body, tenant!) },
      { requestId },
    ),
  );
}
