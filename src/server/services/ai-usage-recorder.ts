import type { AIPurpose, AIProviderName, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { AITokenUsage } from "@/lib/ai/types";
import { estimateTokenCostUsd, aiModelRegistry } from "@/lib/ai/model-registry";
import { USAGE_METER_KEYS } from "@/lib/billing/entitlements";
import { usageMeteringService } from "@/server/services/usage-metering-service";

export class AIUsageRecorder {
  async record(input: {
    organisationId: string;
    projectId?: string;
    userProfileId?: string;
    aiRequestId?: string;
    aiExecutionId?: string;
    provider: AIProviderName;
    model: string;
    purpose: AIPurpose;
    usage: AITokenUsage;
  }): Promise<void> {
    const model = aiModelRegistry.getModel(input.provider, input.model);
    const estimatedCostUsd = estimateTokenCostUsd(model, input.usage);

    await prisma.aIUsageRecord.create({
      data: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        userProfileId: input.userProfileId,
        aiRequestId: input.aiRequestId,
        aiExecutionId: input.aiExecutionId,
        provider: input.provider,
        model: input.model,
        purpose: input.purpose,
        promptTokens: input.usage.promptTokens,
        completionTokens: input.usage.completionTokens,
        totalTokens: input.usage.totalTokens,
        estimatedCostUsd,
      },
    });

    if (input.aiExecutionId) {
      await usageMeteringService.recordUsage({
        organisationId: input.organisationId,
        meterKey: USAGE_METER_KEYS.AI_TOKENS,
        amount: input.usage.totalTokens,
        idempotencyKey: `ai-execution-${input.aiExecutionId}`,
        period: "BILLING_PERIOD",
        metadata: { purpose: input.purpose, provider: input.provider, model: input.model },
      });
    }
  }

  async getOrganisationUsageToday(organisationId: string) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    return prisma.aIUsageRecord.aggregate({
      where: { organisationId, recordedAt: { gte: since } },
      _sum: { totalTokens: true, estimatedCostUsd: true },
      _count: true,
    });
  }
}

export const aiUsageRecorder = new AIUsageRecorder();

export type UsageDashboardSummary = {
  requestsToday: number;
  totalTokensToday: number;
  estimatedCostUsdToday: Prisma.Decimal | number | null;
  activeAutomations: number;
  pendingApprovals: number;
  completedActionsToday: number;
  failedActionsToday: number;
};

export async function getOrganisationUsageDashboard(
  organisationId: string,
): Promise<UsageDashboardSummary> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [aggregate, activeAutomations, pendingApprovals, completedActionsToday, failedActionsToday] =
    await Promise.all([
      prisma.aIUsageRecord.aggregate({
        where: { organisationId, recordedAt: { gte: since } },
        _sum: { totalTokens: true, estimatedCostUsd: true },
        _count: true,
      }),
      prisma.automationWorkflow.count({
        where: { organisationId, status: "ACTIVE", archivedAt: null },
      }),
      prisma.agentPlatformApproval.count({
        where: { organisationId, status: "PENDING" },
      }),
      prisma.automationExecution.count({
        where: { organisationId, status: "COMPLETED", completedAt: { gte: since } },
      }),
      prisma.automationExecution.count({
        where: {
          organisationId,
          status: { in: ["FAILED", "DEAD_LETTER"] },
          completedAt: { gte: since },
        },
      }),
    ]);

  return {
    requestsToday: aggregate._count,
    totalTokensToday: aggregate._sum.totalTokens ?? 0,
    estimatedCostUsdToday: aggregate._sum.estimatedCostUsd ?? 0,
    activeAutomations,
    pendingApprovals,
    completedActionsToday,
    failedActionsToday,
  };
}
