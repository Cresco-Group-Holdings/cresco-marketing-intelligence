import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withTopicsStrategy } from "@/lib/api/topics-handler";
import { seoTopicClusterAiService } from "@/server/services/seo-topic-cluster-ai-service";

type Params = { params: Promise<{ brandId: string; clusterId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, clusterId } = await params;
  const organisationId = requireOrganisationId(request);
  return withTopicsStrategy(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await seoTopicClusterAiService.proposeStrategy(clusterId, brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}
