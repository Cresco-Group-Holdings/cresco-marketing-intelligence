import { prisma } from "@/lib/database/prisma";
import {
  AI_ORGANISATION_DAILY_TOKEN_LIMIT,
  AI_PER_REQUEST_TOKEN_LIMIT,
  AI_USER_DAILY_TOKEN_LIMIT,
} from "@/lib/ai/constants";
import { AppError } from "@/lib/errors";
import { estimateTokenCostUsd } from "@/lib/ai/model-registry";
import type { RegisteredAIModel } from "@/lib/ai/types";

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function assertRequestTokenBudget(estimatedTokens: number): Promise<void> {
  if (estimatedTokens > AI_PER_REQUEST_TOKEN_LIMIT) {
    throw new AppError(
      "RATE_LIMITED",
      `Request exceeds per-request token limit of ${AI_PER_REQUEST_TOKEN_LIMIT}.`,
    );
  }
}

export async function assertOrganisationDailyBudget(organisationId: string): Promise<void> {
  const since = startOfUtcDay();
  const aggregate = await prisma.aIUsageRecord.aggregate({
    where: { organisationId, recordedAt: { gte: since } },
    _sum: { totalTokens: true },
  });

  const used = aggregate._sum.totalTokens ?? 0;
  if (used >= AI_ORGANISATION_DAILY_TOKEN_LIMIT) {
    throw new AppError("RATE_LIMITED", "Organisation AI daily token budget exceeded.");
  }
}

export async function assertUserDailyBudget(userProfileId: string): Promise<void> {
  const since = startOfUtcDay();
  const aggregate = await prisma.aIUsageRecord.aggregate({
    where: { userProfileId, recordedAt: { gte: since } },
    _sum: { totalTokens: true },
  });

  const used = aggregate._sum.totalTokens ?? 0;
  if (used >= AI_USER_DAILY_TOKEN_LIMIT) {
    throw new AppError("RATE_LIMITED", "User AI daily token budget exceeded.");
  }
}

export function estimateRequestCost(
  model: RegisteredAIModel,
  estimatedPromptTokens: number,
  estimatedCompletionTokens: number,
): number {
  return estimateTokenCostUsd(model, {
    promptTokens: estimatedPromptTokens,
    completionTokens: estimatedCompletionTokens,
  });
}

export type UsageSummary = {
  organisationTokensToday: number;
  userTokensToday: number;
  organisationBudgetRemaining: number;
  userBudgetRemaining: number;
};

export async function getUsageSummary(
  organisationId: string,
  userProfileId: string,
): Promise<UsageSummary> {
  const since = startOfUtcDay();
  const [organisationAggregate, userAggregate] = await Promise.all([
    prisma.aIUsageRecord.aggregate({
      where: { organisationId, recordedAt: { gte: since } },
      _sum: { totalTokens: true },
    }),
    prisma.aIUsageRecord.aggregate({
      where: { userProfileId, recordedAt: { gte: since } },
      _sum: { totalTokens: true },
    }),
  ]);

  const organisationTokensToday = organisationAggregate._sum.totalTokens ?? 0;
  const userTokensToday = userAggregate._sum.totalTokens ?? 0;

  return {
    organisationTokensToday,
    userTokensToday,
    organisationBudgetRemaining: Math.max(
      0,
      AI_ORGANISATION_DAILY_TOKEN_LIMIT - organisationTokensToday,
    ),
    userBudgetRemaining: Math.max(0, AI_USER_DAILY_TOKEN_LIMIT - userTokensToday),
  };
}
