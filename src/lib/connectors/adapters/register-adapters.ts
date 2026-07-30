import { connectorAdapterFactory } from "@/lib/connectors/adapters/fake-connector-adapter";
import { ga4AnalyticsAdapter } from "@/lib/connectors/adapters/ga4-analytics-adapter";
import { gscSearchConsoleAdapter } from "@/lib/connectors/adapters/gsc-search-console-adapter";

let registered = false;

export function registerProductionConnectorAdapters(): void {
  if (registered) return;
  connectorAdapterFactory.register(ga4AnalyticsAdapter);
  connectorAdapterFactory.register(gscSearchConsoleAdapter);
  registered = true;
}

registerProductionConnectorAdapters();
