import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withPublicationApprove } from "@/lib/api/publication-handler";
import { publicationService } from "@/server/services/publication-service";

type Params = { params: Promise<{ brandId: string; publicationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, publicationId } = await params;
  const organisationId = requireOrganisationId(request);
  return withPublicationApprove(request, organisationId, async ({ requestId, tenant }) => {
    const publication = await publicationService.approve(brandId, organisationId, publicationId, tenant!, requestId);
    return apiSuccess({ publication }, { requestId });
  });
}
