import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withVisualStudioWrite } from "@/lib/api/visual-studio-handler";
import { visualElementUpdateSchema } from "@/lib/validation/visual-studio";
import { visualStudioService } from "@/server/services/visual-studio-service";

type Params = { params: Promise<{ brandId: string; visualProjectId: string; elementId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, visualProjectId, elementId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(visualElementUpdateSchema, await jsonBody(request));
  return withVisualStudioWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        project: await visualStudioService.updateElement(
          brandId,
          organisationId,
          visualProjectId,
          elementId,
          body,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
