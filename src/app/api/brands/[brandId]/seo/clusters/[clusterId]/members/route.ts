import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withTopicsManage } from "@/lib/api/topics-handler";
import { addClusterMemberSchema } from "@/lib/validation/topics";
import { seoTopicClusterService } from "@/server/services/seo-topic-cluster-service";

type Params = { params: Promise<{ brandId: string; clusterId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, clusterId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withTopicsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(addClusterMemberSchema, body);
    const member = await seoTopicClusterService.addMember(clusterId, brandId, organisationId, input, tenant!);
    return apiSuccess({ member }, { requestId });
  });
}
