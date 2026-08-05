import type { SyncResourceType } from "@/lib/integrations/sync/constants";
import { STAGE_13_SYNC_PROVIDER_KEYS } from "@/lib/integrations/sync/constants";
import type { SyncPageResult } from "@/lib/integrations/sync/types";
import { generateMockSyncPage } from "@/server/providers/sync/mock-sync-adapter";

export type ProviderSyncAdapterContext = {
  organisationId: string;
  connectionId: string;
  providerKey: string;
  accessToken: string;
  dateRange?: { start: Date; end: Date };
};

export type ProviderSyncAdapter = {
  providerKey: string;
  fetchPage(input: {
    context: ProviderSyncAdapterContext;
    resourceType: SyncResourceType;
    cursor?: string;
    pageSize?: number;
  }): Promise<SyncPageResult>;
};

const mockAdapter: ProviderSyncAdapter = {
  providerKey: "*",
  fetchPage: async ({ context, resourceType, cursor, pageSize }) =>
    generateMockSyncPage({
      providerKey: context.providerKey,
      resourceType,
      cursor,
      pageSize,
      dateRange: context.dateRange,
    }),
};

const registry = new Map<string, ProviderSyncAdapter>(
  STAGE_13_SYNC_PROVIDER_KEYS.map((key) => [key, { ...mockAdapter, providerKey: key }]),
);

export const providerSyncAdapterRegistry = {
  resolve(providerKey: string): ProviderSyncAdapter | undefined {
    return registry.get(providerKey) ?? mockAdapter;
  },

  register(adapter: ProviderSyncAdapter) {
    registry.set(adapter.providerKey, adapter);
  },

  listProviderKeys(): string[] {
    return [...registry.keys()];
  },
};
