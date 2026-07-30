import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withTopicsManage, withTopicsRead } from "@/lib/api/topics-handler";
import { updateClusterSchema } from "@/lib/validation/topics";
import { seoContentStrategyService } from "@/server/services/seo-content-strategy-service";
import { seoTopicClusterService } from "@/server/services/seo-topic-cluster-service";

type Params = { params: Promise<{ brandId: string; clusterId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, clusterId } = await params;
  const organisationId = requireOrganisationId(request);
  const view = request.nextUrl.searchParams.get("view");

  if (view === "graph") {
    return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        await seoTopicClusterService.getClusterGraph(clusterId, brandId, organisationId, tenant!),
        { requestId },
      ),
    );
  }

  if (view === "funnel") {
    return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        { coverage: await seoTopicClusterService.getFunnelCoverage(brandId, organisationId, tenant!) },
        { requestId },
      ),
    );
  }

  return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { cluster: await seoTopicClusterService.getCluster(clusterId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, clusterId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateClusterSchema, body);
    const cluster = await seoTopicClusterService.updateCluster(clusterId, brandId, organisationId, input, tenant!);
    return apiSuccess({ cluster }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, clusterId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");

  if (action === "score") {
    return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        { score: await seoContentStrategyService.scoreCluster(clusterId, brandId, organisationId, tenant!) },
        { requestId },
      ),
    );
  }

  return withTopicsRead(request, organisationId, async ({ requestId }) =>
    apiSuccess({ error: "Unknown action" }, { requestId }),
  );
}
