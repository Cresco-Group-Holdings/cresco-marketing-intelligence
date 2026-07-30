import { connectorAdapterFactory } from "@/lib/connectors/adapters/fake-connector-adapter";
import { ga4AnalyticsAdapter } from "@/lib/connectors/adapters/ga4-analytics-adapter";

let registered = false;

export function registerProductionConnectorAdapters(): void {
  if (registered) return;
  connectorAdapterFactory.register(ga4AnalyticsAdapter);
  registered = true;
}

registerProductionConnectorAdapters();
