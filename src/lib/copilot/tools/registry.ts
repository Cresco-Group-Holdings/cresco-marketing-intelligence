import type { CopilotToolName, CopilotToolResult } from "@/lib/copilot/types";

export const COPILOT_TOOL_ALLOWLIST = new Set<CopilotToolName>([
  "getMarketingOverview",
  "getPaidPerformance",
  "getCampaignPerformance",
  "getCreativePerformance",
  "getOrganicPerformance",
  "getContentPerformance",
  "getPublishingSchedule",
  "getAttributionSummary",
  "getRevenueAnalytics",
  "getDataCoverage",
  "getMarketingSignals",
]);

export function isAllowedCopilotTool(name: string): name is CopilotToolName {
  return COPILOT_TOOL_ALLOWLIST.has(name as CopilotToolName);
}

export function validateToolArgs(input: {
  toolName: CopilotToolName;
  brandId: string;
  organisationId: string;
  from: Date;
  to: Date;
  limit?: number;
}): void {
  if (!input.brandId || !input.organisationId) {
    throw new Error("Tenant scope is required for copilot tools.");
  }
  if (input.from > input.to) {
    throw new Error("Invalid date range.");
  }
  if (input.limit != null && (input.limit < 1 || input.limit > 25)) {
    throw new Error("Tool limit out of bounds.");
  }
}

export type CopilotToolContext = {
  brandId: string;
  organisationId: string;
  from: Date;
  to: Date;
  comparisonFrom: Date;
  comparisonTo: Date;
  attributionModel?: string;
  limit?: number;
};

export type CopilotToolExecutor = (
  context: CopilotToolContext,
) => Promise<CopilotToolResult>;
