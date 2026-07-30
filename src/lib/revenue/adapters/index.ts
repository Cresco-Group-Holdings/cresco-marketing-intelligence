import type { RevenueSourceType } from "@prisma/client";
import {
  crmRevenueAdapter,
  internalEventsAdapter,
  manualImportAdapter,
} from "@/lib/revenue/adapters/crm-revenue-adapter";
import { stripeRevenueAdapter } from "@/lib/revenue/adapters/stripe-adapter";
import type { RevenueAdapter } from "@/lib/revenue/types";

const adapters: Record<RevenueSourceType, RevenueAdapter> = {
  STRIPE: stripeRevenueAdapter,
  CRM: crmRevenueAdapter,
  MANUAL_IMPORT: manualImportAdapter,
  INTERNAL_EVENT: internalEventsAdapter,
};

export function getRevenueAdapter(sourceType: RevenueSourceType): RevenueAdapter {
  return adapters[sourceType];
}

export function listAvailableRevenueAdapters(): Array<{ sourceType: RevenueSourceType; available: boolean }> {
  return Object.values(adapters).map((adapter) => ({
    sourceType: adapter.sourceType,
    available: adapter.isAvailable(),
  }));
}
