import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withPublicationPublish } from "@/lib/api/publication-handler";
import { publicationExecutionService } from "@/server/services/publication-execution-service";

type Params = { params: Promise<{ brandId: string; publicationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, publicationId } = await params;
  const organisationId = requireOrganisationId(request);
  return withPublicationPublish(request, organisationId, async ({ requestId, tenant }) => {
    const result = await publicationExecutionService.preview(publicationId, organisationId, brandId, tenant!);
    return apiSuccess(result, { requestId });
  });
}
