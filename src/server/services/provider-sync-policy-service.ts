import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { ProviderSyncSchedule } from "@prisma/client";
import {
  PROVIDER_DEFAULT_RESOURCE_TYPES,
  type SyncResourceType,
} from "@/lib/integrations/sync/constants";

export const providerSyncPolicyService = {
  async getOrCreatePolicy(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    const existing = await prisma.providerSyncPolicy.findUnique({ where: { connectionId } });
    if (existing) return existing;

    const defaultResourceTypes =
      PROVIDER_DEFAULT_RESOURCE_TYPES[connection.providerKey] ?? ["provider_account", "metric_daily"];

    return prisma.providerSyncPolicy.create({
      data: {
        organisationId: context.organisationId,
        connectionId,
        resourceTypes: defaultResourceTypes,
      },
    });
  },

  async updatePolicy(
    context: TenantContext,
    connectionId: string,
    input: {
      schedule?: ProviderSyncSchedule;
      customIntervalMinutes?: number;
      resourceTypes?: SyncResourceType[];
      backfillDays?: number;
      timezone?: string;
      enabled?: boolean;
    },
  ) {
    await this.getOrCreatePolicy(context, connectionId);
    return prisma.providerSyncPolicy.update({
      where: { connectionId },
      data: {
        ...(input.schedule ? { schedule: input.schedule } : {}),
        ...(input.customIntervalMinutes !== undefined
          ? { customIntervalMinutes: input.customIntervalMinutes }
          : {}),
        ...(input.resourceTypes ? { resourceTypes: input.resourceTypes } : {}),
        ...(input.backfillDays !== undefined ? { backfillDays: input.backfillDays } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  },
};
