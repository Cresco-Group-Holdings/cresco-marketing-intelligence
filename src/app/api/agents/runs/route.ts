import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withAgentRead,
  withAgentRun,
} from "@/lib/api/agent-platform-handler";
import { agentRunInputSchema } from "@/lib/validation/agent-platform";
import { agentPlatformService } from "@/server/services/agent-platform-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const agentKey = request.nextUrl.searchParams.get("agentKey") ?? undefined;

  return withAgentRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { runs: await agentPlatformService.listRuns(organisationId, tenant!, agentKey) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = parseBody(agentRunInputSchema, await jsonBody(request));

  return withAgentRun(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { run: await agentPlatformService.runAgent(organisationId, body, tenant!) },
      { requestId },
    ),
  );
}
