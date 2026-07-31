import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withTopicsManage, withTopicsRead } from "@/lib/api/topics-handler";
import { createTopicSchema } from "@/lib/validation/topics";
import { seoTopicClusterService } from "@/server/services/seo-topic-cluster-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withTopicsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { items: await seoTopicClusterService.listTopics(brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createTopicSchema, body);
    const topic = await seoTopicClusterService.createTopic(brandId, organisationId, input, tenant!);
    return apiSuccess({ topic }, { requestId });
  });
}
