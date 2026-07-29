import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withVisualStudioWrite } from "@/lib/api/visual-studio-handler";
import { visualPageReorderSchema } from "@/lib/validation/visual-studio";
import { visualStudioService } from "@/server/services/visual-studio-service";

type Params = { params: Promise<{ brandId: string; visualProjectId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, visualProjectId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(visualPageReorderSchema, await jsonBody(request));
  return withVisualStudioWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        project: await visualStudioService.reorderPages(
          brandId,
          organisationId,
          visualProjectId,
          body.pageIds,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
