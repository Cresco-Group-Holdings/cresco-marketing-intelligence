import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withVisualStudioRead } from "@/lib/api/visual-studio-handler";
import { visualStudioService } from "@/server/services/visual-studio-service";

type Params = { params: Promise<{ brandId: string; visualProjectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, visualProjectId } = await params;
  const organisationId = requireOrganisationId(request);
  return withVisualStudioRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        project: await visualStudioService.getProject(
          brandId,
          organisationId,
          visualProjectId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
