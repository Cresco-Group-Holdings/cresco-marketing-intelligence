import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withTopicsCluster,
  withTopicsManage,
  withTopicsRead,
} from "@/lib/api/topics-handler";
import { createClusterSchema, runClusteringSchema } from "@/lib/validation/topics";
import { seoTopicClusterService } from "@/server/services/seo-topic-cluster-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const topicId = request.nextUrl.searchParams.get("topicId") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { items: await seoTopicClusterService.listClusters(brandId, organisationId, tenant!, { topicId, status }) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json();

  if (action === "cluster") {
    return withTopicsCluster(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(runClusteringSchema, body);
      const result = await seoTopicClusterService.runClustering(brandId, organisationId, input, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createClusterSchema, body);
    const cluster = await seoTopicClusterService.createCluster(brandId, organisationId, input, tenant!);
    return apiSuccess({ cluster }, { requestId });
  });
}
