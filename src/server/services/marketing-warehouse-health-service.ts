import type { MarketingDataSourceHealthStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { computeFreshnessState } from "@/lib/warehouse/freshness";
import { getWarehouseConfig } from "@/lib/warehouse/config";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function healthStatusFromFreshness(
  state: ReturnType<typeof computeFreshnessState>["state"],
): MarketingDataSourceHealthStatus {
  switch (state) {
    case "FRESH":
      return "HEALTHY";
    case "STALE":
      return "DEGRADED";
    case "CRITICAL":
      return "UNHEALTHY";
    default:
      return "UNKNOWN";
  }
}

export const marketingWarehouseHealthService = {
  async computeHealth(
    marketingDataSourceAccountId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const account = await prisma.marketingDataSourceAccount.findFirst({
      where: { id: marketingDataSourceAccountId, organisationId },
      include: { marketingDataSource: true },
    });
    if (!account) {
      return null;
    }

    if (account.status === "INACTIVE" || account.status === "DEPRECATED") {
      return prisma.marketingDataSourceHealth.create({
        data: {
          organisationId: account.organisationId,
          projectId: account.projectId,
          brandId: account.brandId,
          marketingDataSourceAccountId: account.id,
          status: "UNKNOWN",
          freshnessLagMinutes: null,
          lastSuccessfulSyncAt: account.lastSyncAt,
          errorMessage: `Source account is ${account.status.toLowerCase()}.`,
          metadata: {
            connectorState: account.status,
            freshnessState: null,
            provider: account.marketingDataSource.provider,
          },
        },
      });
    }

    if (account.lastSyncStatus === "FAILED") {
      return prisma.marketingDataSourceHealth.create({
        data: {
          organisationId: account.organisationId,
          projectId: account.projectId,
          brandId: account.brandId,
          marketingDataSourceAccountId: account.id,
          status: "UNHEALTHY",
          freshnessLagMinutes: null,
          lastSuccessfulSyncAt: account.lastSyncAt,
          errorMessage: "Last sync attempt failed.",
          metadata: {
            connectorState: "AUTH_OR_SYNC_ERROR",
            freshnessState: null,
            provider: account.marketingDataSource.provider,
          },
        },
      });
    }

    const config = getWarehouseConfig();
    const lastBatch = await prisma.rawMarketingBatch.findFirst({
      where: {
        marketingDataSourceAccountId: account.id,
        status: { in: ["COMPLETED", "PARTIAL"] },
      },
      orderBy: { completedAt: "desc" },
    });

    const lastSuccessfulSyncAt = lastBatch?.completedAt ?? account.lastSyncAt;
    const freshness = computeFreshnessState({
      lastSuccessfulSyncAt,
      expectedIntervalMinutes: config.defaultSyncIntervalMinutes,
    });
    const status = healthStatusFromFreshness(freshness.state);

    return prisma.marketingDataSourceHealth.create({
      data: {
        organisationId: account.organisationId,
        projectId: account.projectId,
        brandId: account.brandId,
        marketingDataSourceAccountId: account.id,
        status,
        freshnessLagMinutes: freshness.lagMinutes,
        lastSuccessfulSyncAt,
        errorMessage:
          status === "UNHEALTHY"
            ? `Data is critically stale (${freshness.lagMinutes ?? "unknown"} minutes lag).`
            : null,
        metadata: {
          connectorState: "ACTIVE",
          freshnessState: freshness.state,
          provider: account.marketingDataSource.provider,
        },
      },
    });
  },

  async listHealth(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);

    const accounts = await prisma.marketingDataSourceAccount.findMany({
      where: { organisationId, brandId },
      include: { marketingDataSource: true },
    });

    const healthRecords = await Promise.all(
      accounts.map(async (account) => {
        const latest = await prisma.marketingDataSourceHealth.findFirst({
          where: { marketingDataSourceAccountId: account.id },
          orderBy: { lastCheckedAt: "desc" },
        });

        if (latest) {
          return { account, health: latest };
        }

        const computed = await this.computeHealth(account.id, organisationId, context);
        return { account, health: computed };
      }),
    );

    const summary = {
      healthy: healthRecords.filter((row) => row.health?.status === "HEALTHY").length,
      degraded: healthRecords.filter((row) => row.health?.status === "DEGRADED").length,
      unhealthy: healthRecords.filter((row) => row.health?.status === "UNHEALTHY").length,
      unknown: healthRecords.filter((row) => row.health?.status === "UNKNOWN").length,
    };

    return { summary, items: healthRecords };
  },
};
