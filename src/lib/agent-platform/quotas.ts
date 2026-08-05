import { prisma } from "@/lib/database/prisma";
import {
  AGENT_DEFAULT_DAILY_COST_LIMIT_USD,
  AGENT_DEFAULT_DAILY_RUN_LIMIT,
  AGENT_DEFAULT_DAILY_TOKEN_LIMIT,
} from "@/lib/agent-platform/constants";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function getOrCreateQuota(organisationId: string) {
  const existing = await prisma.agentPlatformQuota.findUnique({ where: { organisationId } });
  if (existing) return existing;

  return prisma.agentPlatformQuota.create({
    data: {
      organisationId,
      dailyRunLimit: AGENT_DEFAULT_DAILY_RUN_LIMIT,
      dailyTokenLimit: AGENT_DEFAULT_DAILY_TOKEN_LIMIT,
      dailyCostLimitUsd: AGENT_DEFAULT_DAILY_COST_LIMIT_USD,
      resetAt: startOfUtcDay(),
    },
  });
}

async function maybeResetQuota(quota: Awaited<ReturnType<typeof getOrCreateQuota>>) {
  const dayStart = startOfUtcDay();
  if (quota.resetAt >= dayStart) return quota;

  return prisma.agentPlatformQuota.update({
    where: { id: quota.id },
    data: {
      runsToday: 0,
      tokensToday: 0,
      costTodayUsd: new Prisma.Decimal(0),
      resetAt: dayStart,
    },
  });
}

export async function assertAgentRunQuota(organisationId: string) {
  const quota = await maybeResetQuota(await getOrCreateQuota(organisationId));

  if (quota.runsToday >= quota.dailyRunLimit) {
    throw new AppError("RATE_LIMITED", "Agent daily run quota exceeded for this organisation.");
  }
}

export async function recordAgentQuotaUsage(
  organisationId: string,
  usage: { tokens: number; costUsd: number },
) {
  const quota = await maybeResetQuota(await getOrCreateQuota(organisationId));

  const nextTokens = quota.tokensToday + usage.tokens;
  const nextCost = new Prisma.Decimal(quota.costTodayUsd).add(usage.costUsd);

  if (nextTokens > quota.dailyTokenLimit) {
    throw new AppError("RATE_LIMITED", "Agent daily token quota exceeded for this organisation.");
  }
  if (nextCost.greaterThan(quota.dailyCostLimitUsd)) {
    throw new AppError("RATE_LIMITED", "Agent daily cost quota exceeded for this organisation.");
  }

  return prisma.agentPlatformQuota.update({
    where: { id: quota.id },
    data: {
      runsToday: { increment: 1 },
      tokensToday: nextTokens,
      costTodayUsd: nextCost,
    },
  });
}

export async function getAgentQuotaSummary(organisationId: string) {
  const quota = await maybeResetQuota(await getOrCreateQuota(organisationId));
  return {
    dailyRunLimit: quota.dailyRunLimit,
    dailyTokenLimit: quota.dailyTokenLimit,
    dailyCostLimitUsd: Number(quota.dailyCostLimitUsd.toString()),
    runsToday: quota.runsToday,
    tokensToday: quota.tokensToday,
    costTodayUsd: Number(quota.costTodayUsd.toString()),
    runsRemaining: Math.max(0, quota.dailyRunLimit - quota.runsToday),
    tokensRemaining: Math.max(0, quota.dailyTokenLimit - quota.tokensToday),
  };
}
