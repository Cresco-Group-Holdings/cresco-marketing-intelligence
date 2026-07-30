import type { RevenueAdapter, RevenueAdapterSyncResult } from "@/lib/revenue/types";

const unavailable = async (): Promise<RevenueAdapterSyncResult> => ({
  customers: [],
  subscriptions: [],
  transactions: [],
});

export const crmRevenueAdapter: RevenueAdapter = {
  sourceType: "CRM",
  isAvailable: () => true,
  sync: unavailable,
};

export const manualImportAdapter: RevenueAdapter = {
  sourceType: "MANUAL_IMPORT",
  isAvailable: () => true,
  sync: unavailable,
};

export const internalEventsAdapter: RevenueAdapter = {
  sourceType: "INTERNAL_EVENT",
  isAvailable: () => true,
  sync: unavailable,
};
