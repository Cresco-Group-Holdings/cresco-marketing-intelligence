import { createHash } from "node:crypto";
import type { TenantContext } from "@/lib/tenancy/context";
import { AppError } from "@/lib/errors";
import { hasPermission, type Permission } from "@/lib/tenancy/permissions";
import { getAgentDefinition } from "@/lib/agent-platform/agent-registry";

export type AgentRunScope = {
  organisationId: string;
  projectId?: string;
  brandId?: string;
  campaignId?: string;
};

export type AgentContextInput = {
  tenant: TenantContext;
  agentKey: string;
  scope: AgentRunScope;
  userInput: string;
};

export type AgentExecutionContext = {
  organisationId: string;
  projectId?: string;
  brandId?: string;
  campaignId?: string;
  userProfileId: string;
  organisationRole: TenantContext["organisationRole"];
  agentKey: string;
  userInput: string;
  contextDigest: string;
};

function digestContext(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function assertAgentPermissions(input: AgentContextInput) {
  const definition = getAgentDefinition(input.agentKey);
  if (!definition) {
    throw new AppError("NOT_FOUND", `Unknown agent: ${input.agentKey}`);
  }

  if (input.tenant.organisationId !== input.scope.organisationId) {
    throw new AppError("FORBIDDEN", "Agent cannot access another tenant.");
  }

  for (const permission of definition.requiredPermissions) {
    if (!hasPermission(input.tenant.organisationRole, permission)) {
      throw new AppError("FORBIDDEN", `Missing permission: ${permission}`);
    }
  }

  return definition;
}

export function buildAgentExecutionContext(input: AgentContextInput): AgentExecutionContext {
  const definition = assertAgentPermissions(input);
  const contextDigest = digestContext({
    organisationId: input.scope.organisationId,
    projectId: input.scope.projectId ?? null,
    brandId: input.scope.brandId ?? null,
    campaignId: input.scope.campaignId ?? null,
    agentKey: input.agentKey,
    allowedTools: definition.allowedTools,
  });

  return {
    organisationId: input.scope.organisationId,
    projectId: input.scope.projectId,
    brandId: input.scope.brandId,
    campaignId: input.scope.campaignId,
    userProfileId: input.tenant.userProfileId,
    organisationRole: input.tenant.organisationRole,
    agentKey: input.agentKey,
    userInput: input.userInput,
    contextDigest,
  };
}
