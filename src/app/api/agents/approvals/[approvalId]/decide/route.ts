import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withAgentApprove,
} from "@/lib/api/agent-platform-handler";
import { agentApprovalDecisionSchema } from "@/lib/validation/agent-platform";
import { agentApprovalService } from "@/server/services/agent-approval-service";

type RouteContext = { params: Promise<{ approvalId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const organisationId = requireOrganisationId(request);
  const { approvalId } = await context.params;
  const body = parseBody(agentApprovalDecisionSchema, await jsonBody(request));

  return withAgentApprove(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        approval: await agentApprovalService.decide(
          organisationId,
          approvalId,
          body,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
