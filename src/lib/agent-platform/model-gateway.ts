import type { AIExecutionResult } from "@/lib/ai/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { resolveAgentModel } from "@/lib/agent-platform/capability-registry";
import { executeWithFallbackRetry } from "@/lib/agent-platform/fallback-retry";

export type AgentModelGatewayInput = {
  organisationId: string;
  projectId?: string;
  brandId?: string;
  userProfileId: string;
  templateKey: string;
  userInput: string;
  brandContext?: Record<string, unknown>;
  modelId?: string;
  requestId?: string;
};

export const agentModelGateway = {
  async executeStructured(
    input: AgentModelGatewayInput,
    context: TenantContext,
  ): Promise<AIExecutionResult<Record<string, unknown>> & { attempts: number; usedFallback: boolean }> {
    const model = resolveAgentModel(input.modelId);

    const { result, attempts, usedFallback } = await executeWithFallbackRetry(async () =>
      aiRequestService.executeStructured(
        {
          organisationId: input.organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          userProfileId: input.userProfileId,
          purpose: "AGENT_ORCHESTRATION",
          provider: model.provider,
          model: model.modelId,
          templateKey: input.templateKey,
          userInput: input.userInput,
          brandContext: input.brandContext,
          requestId: input.requestId,
          schemaKey: "agent.platform_response",
        },
        context,
      ),
    );

    return { ...result, attempts, usedFallback };
  },
};
