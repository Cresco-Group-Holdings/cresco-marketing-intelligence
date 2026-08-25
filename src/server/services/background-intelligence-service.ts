import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";
import { operationalAlertService } from "@/server/services/operational-alert-service";

const STALE_THRESHOLD_MS = 12 * 60 * 60_000;

export type BackgroundIntelligenceSummary = {
  staleSourcesChecked: number;
  staleAlertsCreated: number;
  brandsEvaluated: number;
  workerHealthAlert: boolean;
};

export const backgroundIntelligenceService = {
  async evaluateStaleData(now = new Date()): Promise<{ checked: number; alerts: number }> {
    const connections = await prisma.providerConnection.findMany({
      where: {
        status: { in: ["CONNECTED", "RECONNECTED"] },
        organisation: { status: "ACTIVE", archivedAt: null },
      },
      select: {
        id: true,
        organisationId: true,
        projectId: true,
        brandId: true,
        providerKey: true,
        lastSuccessfulAt: true,
        brand: { select: { name: true } },
      },
      take: 200,
    });

    let alerts = 0;
    for (const connection of connections) {
      const lastSync = connection.lastSuccessfulAt?.getTime() ?? 0;
      if (now.getTime() - lastSync <= STALE_THRESHOLD_MS) continue;

      await operationalAlertService.upsert({
        organisationId: connection.organisationId,
        projectId: connection.projectId ?? undefined,
        brandId: connection.brandId ?? undefined,
        alertType: "CONNECTOR_SYNC_FAILURE",
        category: "INTEGRATION",
        resourceType: "ProviderConnection",
        resourceId: connection.id,
        provider: connection.providerKey,
        title: `${connection.providerKey} data is stale`,
        safeErrorMessage: `Last successful sync exceeded freshness threshold for ${connection.brand?.name ?? "brand"}.`,
        recommendedAction: "RETRY_SYNC",
        attemptCount: 1,
        maxAttempts: 3,
        idempotencyKey: `stale:${connection.id}:${now.toISOString().slice(0, 10)}`,
      });
      alerts += 1;
    }

    return { checked: connections.length, alerts };
  },

  async checkWorkerHealth(now = new Date()): Promise<boolean> {
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
    const recentSuccess = await prisma.workerJob.count({
      where: { status: "SUCCEEDED", completedAt: { gte: oneHourAgo } },
    });
    const pendingBacklog = await prisma.workerJob.count({
      where: { status: { in: ["READY", "SCHEDULED", "RETRY_WAIT"] } },
    });

    if (recentSuccess === 0 && pendingBacklog > 10) {
      logger.warn("worker.health_stalled", { pendingBacklog });
      return true;
    }
    return false;
  },

  async runIntelligencePass(limit = 20): Promise<BackgroundIntelligenceSummary> {
    const now = new Date();
    const stale = await this.evaluateStaleData(now);
    const workerHealthAlert = await this.checkWorkerHealth(now);

    return {
      staleSourcesChecked: stale.checked,
      staleAlertsCreated: stale.alerts,
      brandsEvaluated: Math.min(
        limit,
        await prisma.brand.count({
          where: { organisation: { status: "ACTIVE", archivedAt: null } },
        }),
      ),
      workerHealthAlert,
    };
  },
};
