import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withAgentRead,
} from "@/lib/api/agent-platform-handler";
import { listAgentDefinitions } from "@/lib/agent-platform/agent-registry";
import { AGENT_TOOL_DEFINITIONS } from "@/lib/agent-platform/tool-registry";
import { listAgentCapableModels } from "@/lib/agent-platform/capability-registry";
import { getAgentQuotaSummary } from "@/lib/agent-platform/quotas";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withAgentRead(request, organisationId, async ({ requestId }) =>
    apiSuccess(
      {
        agents: listAgentDefinitions(),
        tools: AGENT_TOOL_DEFINITIONS,
        models: listAgentCapableModels(),
        quotas: await getAgentQuotaSummary(organisationId),
      },
      { requestId },
    ),
  );
}
