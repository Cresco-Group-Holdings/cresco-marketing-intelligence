import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withPublicationPublish } from "@/lib/api/publication-handler";
import { publicationAnalyticsSyncService } from "@/server/services/publication-analytics-sync-service";

type Params = { params: Promise<{ brandId: string; publicationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { publicationId } = await params;
  const organisationId = requireOrganisationId(request);

  return withPublicationPublish(request, organisationId, async ({ tenant, requestId }) => {
    const result = await publicationAnalyticsSyncService.syncPublication(
      publicationId,
      organisationId,
      tenant!,
      { force: true },
    );
    return apiSuccess(result, { requestId });
  });
}
