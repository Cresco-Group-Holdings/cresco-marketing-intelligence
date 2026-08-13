import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withPublicationPublish, withPublicationRead } from "@/lib/api/publication-handler";
import { publicationService } from "@/server/services/publication-service";

type Params = { params: Promise<{ brandId: string; publicationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, publicationId } = await params;
  const organisationId = requireOrganisationId(request);
  return withPublicationRead(request, organisationId, async ({ requestId, tenant }) => {
    const publication = await publicationService.get(brandId, organisationId, publicationId, tenant!);
    return apiSuccess({ publication }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, publicationId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "cancel") {
    return withPublicationPublish(request, organisationId, async ({ requestId, tenant }) => {
      const publication = await publicationService.cancel(brandId, organisationId, publicationId, tenant!, requestId);
      return apiSuccess({ publication }, { requestId });
    });
  }

  return withPublicationPublish(request, organisationId, async ({ requestId }) => {
    return apiSuccess({ publicationId, action: body.action ?? "noop" }, { requestId });
  });
}
