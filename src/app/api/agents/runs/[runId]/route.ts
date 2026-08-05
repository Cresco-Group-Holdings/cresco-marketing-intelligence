import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withAgentRead,
} from "@/lib/api/agent-platform-handler";
import { agentPlatformService } from "@/server/services/agent-platform-service";

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const organisationId = requireOrganisationId(request);
  const { runId } = await context.params;

  return withAgentRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { run: await agentPlatformService.getRun(organisationId, runId, tenant!) },
      { requestId },
    ),
  );
}
