import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withPublicationPublish, withPublicationRead } from "@/lib/api/publication-handler";
import { publicationService } from "@/server/services/publication-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  return withPublicationRead(request, organisationId, async ({ requestId, tenant }) => {
    const publications = await publicationService.list(brandId, organisationId, tenant!, {
      status: status as never,
    });
    return apiSuccess({ publications }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withPublicationPublish(request, organisationId, async ({ requestId, tenant }) => {
    const result = await publicationService.create(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess(result, { requestId });
  });
}
