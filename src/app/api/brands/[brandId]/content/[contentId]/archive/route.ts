import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentArchive,
} from "@/lib/api/content-handler";
import { contentService } from "@/server/services/content-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentArchive(request, organisationId, async ({ requestId, tenant }) => {
    await contentService.archive(brandId, organisationId, contentId, tenant!, requestId);
    return apiSuccess({ archived: true }, { requestId });
  });
}
