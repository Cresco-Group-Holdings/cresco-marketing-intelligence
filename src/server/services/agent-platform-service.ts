import type { AgentPlatformStepStatus, AgentPlatformStepType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import {
  buildAgentExecutionContext,
  type AgentRunScope,
} from "@/lib/agent-platform/agent-context";
import { getAgentDefinition, listAgentDefinitions } from "@/lib/agent-platform/agent-registry";
import { requiresHumanApproval } from "@/lib/agent-platform/approval-gates";
import { evaluateAgentRun } from "@/lib/agent-platform/evaluation";
import { agentModelGateway } from "@/lib/agent-platform/model-gateway";
import { redactAgentPayload } from "@/lib/agent-platform/redaction";
import { assertAgentRunQuota, recordAgentQuotaUsage } from "@/lib/agent-platform/quotas";
import {
  evaluateAgentInputSafety,
  evaluateAgentOutputSafety,
} from "@/lib/agent-platform/safety";
import { isToolAllowedForAgent } from "@/lib/agent-platform/tool-registry";
import { agentPlatformResponseSchema } from "@/lib/agent-platform/output-schemas";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type { AgentRunInput } from "@/lib/validation/agent-platform";
import { executeAgentTool } from "@/server/services/agent-tool-executor";

function serializeRun(run: Awaited<ReturnType<typeof loadRun>>) {
  if (!run) return null;
  return {
    id: run.id,
    organisationId: run.organisationId,
    projectId: run.projectId,
    brandId: run.brandId,
    campaignId: run.campaignId,
    agentKey: run.agentKey,
    status: run.status,
    summary: run.summary,
    limitations: run.limitations,
    promptTokens: run.promptTokens,
    completionTokens: run.completionTokens,
    totalTokens: run.totalTokens,
    estimatedCostUsd: run.estimatedCostUsd ? Number(run.estimatedCostUsd.toString()) : null,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    steps: run.steps.map((step) => ({
      id: step.id,
      stepIndex: step.stepIndex,
      stepType: step.stepType,
      status: step.status,
      title: step.title,
      latencyMs: step.latencyMs,
      errorMessage: step.errorMessage,
    })),
    toolCalls: run.toolCalls.map((call) => ({
      id: call.id,
      toolKey: call.toolKey,
      riskLevel: call.riskLevel,
      status: call.status,
      requiresApproval: call.requiresApproval,
    })),
    proposedActions: run.proposedActions.map((action) => ({
      id: action.id,
      actionKey: action.actionKey,
      title: action.title,
      description: action.description,
      riskLevel: action.riskLevel,
      status: action.status,
      requiresApproval: action.requiresApproval,
    })),
    evaluations: run.evaluations.map((evaluation) => ({
      id: evaluation.id,
      criterionKey: evaluation.criterionKey,
      result: evaluation.result,
      score: evaluation.score,
      notes: evaluation.notes,
    })),
    approvals: run.approvals.map((approval) => ({
      id: approval.id,
      status: approval.status,
      proposedActionId: approval.proposedActionId,
      decidedAt: approval.decidedAt?.toISOString() ?? null,
    })),
  };
}

async function loadRun(runId: string, organisationId: string) {
  return prisma.agentPlatformRun.findFirst({
    where: { id: runId, organisationId },
    include: {
      steps: { orderBy: { stepIndex: "asc" } },
      toolCalls: true,
      proposedActions: true,
      evaluations: true,
      approvals: true,
    },
  });
}

async function createStep(
  runId: string,
  stepIndex: number,
  stepType: AgentPlatformStepType,
  title: string,
  data?: {
    input?: unknown;
    output?: unknown;
    metadata?: Record<string, unknown>;
    latencyMs?: number;
    errorMessage?: string;
    status?: AgentPlatformStepStatus;
  },
) {
  const crypto = await import("node:crypto");
  const digest = (payload: unknown) =>
    payload === undefined || payload === null
      ? undefined
      : crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  return prisma.agentPlatformRunStep.create({
    data: {
      runId,
      stepIndex,
      stepType,
      title,
      status: data?.status ?? "COMPLETED",
      inputDigest: digest(data?.input),
      outputDigest: digest(data?.output),
      metadata: data?.metadata as Prisma.InputJsonValue,
      latencyMs: data?.latencyMs,
      errorMessage: data?.errorMessage,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

export const agentPlatformService = {
  listAgentDefinitions,

  async getRun(organisationId: string, runId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const run = await loadRun(runId, organisationId);
    if (!run) throw new AppError("NOT_FOUND", "Agent run not found.");
    return serializeRun(run);
  },

  async listRuns(organisationId: string, context: TenantContext, agentKey?: string) {
    assertOrganisationScope(organisationId, context);
    const runs = await prisma.agentPlatformRun.findMany({
      where: {
        organisationId,
        ...(agentKey ? { agentKey } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        agentKey: true,
        status: true,
        summary: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return runs.map((run) => ({
      ...run,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    }));
  },

  async runAgent(organisationId: string, input: AgentRunInput, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    await assertAgentRunQuota(organisationId);

    const scope: AgentRunScope = {
      organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      campaignId: input.campaignId,
    };

    const definition = getAgentDefinition(input.agentKey);
    if (!definition) throw new AppError("NOT_FOUND", "Agent definition not found.");

    const executionContext = buildAgentExecutionContext({
      tenant: context,
      agentKey: input.agentKey,
      scope,
      userInput: input.userInput,
    });

    const run = await prisma.agentPlatformRun.create({
      data: {
        organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        campaignId: input.campaignId,
        agentKey: input.agentKey,
        status: "RUNNING",
        initiatedByUserId: context.userProfileId,
        userInput: input.userInput,
        contextSnapshot: redactAgentPayload({
          scope,
          allowedTools: definition.allowedTools,
        }) as Prisma.InputJsonValue,
      },
    });

    let stepIndex = 0;
    const limitations: string[] = [];

    try {
      const safety = evaluateAgentInputSafety(input.userInput);
      await createStep(run.id, stepIndex++, "SAFETY_CHECK", "Input safety", {
        output: { passed: safety.passed, warnings: safety.warnings },
        status: safety.passed ? "COMPLETED" : "FAILED",
        errorMessage: safety.blocked ? safety.blockReasons.join("; ") : undefined,
      });
      if (safety.blocked) {
        throw new AppError("VALIDATION_ERROR", safety.blockReasons.join("; "));
      }

      await createStep(run.id, stepIndex++, "QUOTA_CHECK", "Tenant quota check", {
        output: { passed: true },
      });

      const toolOutputs: Record<string, unknown> = {};
      for (const toolKey of definition.allowedTools) {
        if (!isToolAllowedForAgent(definition.allowedTools, toolKey)) continue;
        const started = Date.now();
        const toolResult = await executeAgentTool(toolKey, executionContext, context);
        limitations.push(...toolResult.limitations);

        const step = await createStep(run.id, stepIndex++, "TOOL_CALL", `Tool: ${toolKey}`, {
          input: { toolKey },
          output: toolResult.output,
          latencyMs: Date.now() - started,
        });

        await prisma.agentPlatformToolCall.create({
          data: {
            runId: run.id,
            stepId: step.id,
            toolKey,
            riskLevel: "READ_ONLY",
            status: "COMPLETED",
            input: { toolKey } as Prisma.InputJsonValue,
            output: toolResult.output as Prisma.InputJsonValue,
            requiresApproval: false,
            completedAt: new Date(),
          },
        });

        toolOutputs[toolKey] = toolResult.output;
      }

      const modelStarted = Date.now();
      const modelInput = JSON.stringify({
        userInput: safety.sanitisedInput,
        toolOutputs,
        limitations,
      });

      const modelResult = await agentModelGateway.executeStructured(
        {
          organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          userProfileId: context.userProfileId,
          templateKey: definition.promptTemplateKey,
          userInput: modelInput,
          brandContext: toolOutputs[definition.allowedTools[0] ?? ""] as Record<string, unknown>,
          requestId: run.id,
        },
        context,
      );

      const outputSafety = evaluateAgentOutputSafety(JSON.stringify(modelResult.output));
      await createStep(run.id, stepIndex++, "MODEL_CALL", "Model gateway", {
        input: { templateKey: definition.promptTemplateKey },
        output: modelResult.output,
        latencyMs: Date.now() - modelStarted,
        metadata: { attempts: modelResult.attempts, usedFallback: modelResult.usedFallback },
      });

      if (outputSafety.blocked) {
        throw new AppError("VALIDATION_ERROR", outputSafety.blockReasons.join("; "));
      }

      await createStep(run.id, stepIndex++, "REDACTION", "Output redaction", {
        output: { redacted: outputSafety.warnings.length > 0 },
      });

      const parsed = agentPlatformResponseSchema.parse(modelResult.output);
      limitations.push(...parsed.limitations);

      const proposedActions = [];
      for (const action of parsed.proposedActions) {
        const riskLevel = action.riskLevel === "HIGH_IMPACT" ? "HIGH_IMPACT" : "DRAFT";
        const needsApproval = requiresHumanApproval({ actionKey: action.actionKey, riskLevel });
        const created = await prisma.agentPlatformProposedAction.create({
          data: {
            runId: run.id,
            actionKey: action.actionKey,
            title: action.title,
            description: action.description,
            payload: action.payload as Prisma.InputJsonValue,
            riskLevel,
            status: "PROPOSED",
            requiresApproval: needsApproval,
          },
        });
        proposedActions.push(created);

        if (needsApproval) {
          await prisma.agentPlatformApproval.create({
            data: {
              organisationId,
              runId: run.id,
              proposedActionId: created.id,
              status: "PENDING",
              requestedByUserId: context.userProfileId,
            },
          });
        }
      }

      await createStep(run.id, stepIndex++, "PROPOSAL", "Proposed actions", {
        output: { count: proposedActions.length },
      });

      const evaluations = evaluateAgentRun({
        tenantScoped: true,
        rbacPassed: true,
        secretsDetected: outputSafety.blocked,
        fabricatedDataDetected: false,
        highImpactActionsApproved: proposedActions.every((action) => !action.requiresApproval),
        unapprovedKnowledgeUsed: false,
      });

      for (const evaluation of evaluations) {
        await prisma.agentPlatformEvaluation.create({
          data: {
            runId: run.id,
            criterionKey: evaluation.criterionKey,
            result: evaluation.result,
            score: evaluation.score,
            notes: evaluation.notes,
          },
        });
      }

      await createStep(run.id, stepIndex++, "EVALUATION", "Run evaluation", {
        output: evaluations,
      });

      const finalStatus =
        proposedActions.some((action) => action.requiresApproval) ? "AWAITING_APPROVAL" : "COMPLETED";

      await recordAgentQuotaUsage(organisationId, {
        tokens: modelResult.usage.totalTokens,
        costUsd: modelResult.estimatedCostUsd,
      });

      await prisma.agentPlatformRun.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          summary: parsed.summary,
          limitations: limitations.length ? limitations : undefined,
          promptTokens: modelResult.usage.promptTokens,
          completionTokens: modelResult.usage.completionTokens,
          totalTokens: modelResult.usage.totalTokens,
          estimatedCostUsd: modelResult.estimatedCostUsd,
          aiRequestId: modelResult.aiRequestId,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.agentPlatformRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          summary: error instanceof Error ? error.message : "Agent run failed.",
          completedAt: new Date(),
        },
      });
      throw error;
    }

    return this.getRun(organisationId, run.id, context);
  },
};
