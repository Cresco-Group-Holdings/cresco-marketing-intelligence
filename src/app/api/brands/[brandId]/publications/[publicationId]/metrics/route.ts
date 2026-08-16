import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withPublicationRead } from "@/lib/api/publication-handler";
import { publicationAnalyticsSyncService } from "@/server/services/publication-analytics-sync-service";

type Params = { params: Promise<{ brandId: string; publicationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { publicationId } = await params;
  const organisationId = requireOrganisationId(request);

  return withPublicationRead(request, organisationId, async ({ requestId }) => {
    const data = await publicationAnalyticsSyncService.listMetrics(
      publicationId,
      organisationId,
    );
    return apiSuccess(data, { requestId });
  });
}
