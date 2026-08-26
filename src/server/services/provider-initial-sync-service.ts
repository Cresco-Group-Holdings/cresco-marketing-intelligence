import { PROVIDER_DEFAULT_RESOURCE_TYPES } from "@/lib/integrations/sync/constants";
import { listProviderCapabilities } from "@/lib/providers/capability-registry";
import type { TenantContext } from "@/lib/tenancy/context";
import { providerSyncEngineService } from "@/server/services/provider-sync-engine-service";
import { providerAuditService } from "@/server/services/provider-audit-service";
import { prisma } from "@/lib/database/prisma";

/** Default historical window (days) for first sync per provider. */
export const PROVIDER_INITIAL_SYNC_WINDOWS: Record<string, number> = {
  "google-analytics": 90,
  "google-search-console": 90,
  meta: 30,
  linkedin: 30,
  youtube: 30,
  x: 30,
  tiktok: 30,
};

function resolvePrimarySyncCapability(providerKey: string): string | null {
  const capabilities = listProviderCapabilities(providerKey);
  if (capabilities.includes("ANALYTICS_REPORTS_READ")) return "ANALYTICS_REPORTS_READ";
  if (capabilities.includes("SOCIAL_INSIGHTS_READ")) return "SOCIAL_INSIGHTS_READ";
  if (capabilities.includes("AD_INSIGHTS_READ")) return "AD_INSIGHTS_READ";
  return capabilities[0] ?? null;
}

function resolveResourceType(providerKey: string): string {
  const types = PROVIDER_DEFAULT_RESOURCE_TYPES[providerKey];
  return types?.[0] ?? "provider_account";
}

export const providerInitialSyncService = {
  async triggerAfterAccountSelection(
    context: TenantContext,
    connectionId: string,
    providerKey: string,
  ) {
    const capability = resolvePrimarySyncCapability(providerKey);
    if (!capability) {
      return { queued: false, reason: "no_sync_capability" };
    }

    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) {
      return { queued: false, reason: "connection_not_found" };
    }

    const resourceType = resolveResourceType(providerKey);
    const backfillDays = PROVIDER_INITIAL_SYNC_WINDOWS[providerKey] ?? 30;

    const syncRun = await providerSyncEngineService.startSync(
      connectionId,
      context.organisationId,
      {
        capability,
        resourceType,
        triggerType: "INITIAL_IMPORT",
        idempotencyKey: `initial:${connectionId}:${capability}`,
      },
      context,
    );

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        metadata: {
          ...((connection.metadata ?? {}) as Record<string, unknown>),
          initialSyncStartedAt: new Date().toISOString(),
          initialSyncBackfillDays: backfillDays,
        },
      },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey,
      action: "SYNC_STARTED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
      metadata: { trigger: "initial_import", syncRunId: syncRun.id, backfillDays },
    });

    return { queued: true, syncRunId: syncRun.id, capability, backfillDays };
  },
};
