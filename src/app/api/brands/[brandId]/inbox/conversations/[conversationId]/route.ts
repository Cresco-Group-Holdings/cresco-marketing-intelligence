import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withInboxRead } from "@/lib/api/inbox-handler";
import { socialInboxQueryService } from "@/server/services/social-inbox-query-service";

type Params = { params: Promise<{ brandId: string; conversationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, conversationId } = await params;
  const organisationId = requireOrganisationId(request);

  return withInboxRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await socialInboxQueryService.getConversation(
        brandId,
        organisationId,
        conversationId,
        tenant!,
      ),
      { requestId },
    ),
  );
}
