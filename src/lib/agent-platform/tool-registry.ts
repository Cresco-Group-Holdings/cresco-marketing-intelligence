import type { Permission } from "@/lib/tenancy/permissions";
import { AGENT_TOOL_KEYS } from "@/lib/agent-platform/constants";

export type AgentToolDefinition = {
  key: string;
  name: string;
  description: string;
  riskLevel: "READ_ONLY" | "DRAFT" | "HIGH_IMPACT";
  requiredPermission?: Permission;
  readOnly: boolean;
};

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    key: AGENT_TOOL_KEYS.GET_CAMPAIGN_SUMMARY,
    name: "Get campaign summary",
    description: "Reads campaign metadata within tenant scope.",
    riskLevel: "READ_ONLY",
    readOnly: true,
  },
  {
    key: AGENT_TOOL_KEYS.GET_ANALYTICS_METRICS,
    name: "Get analytics metrics",
    description: "Reads aggregated analytics facts; never fabricates data.",
    riskLevel: "READ_ONLY",
    readOnly: true,
  },
  {
    key: AGENT_TOOL_KEYS.GET_BRAND_KNOWLEDGE,
    name: "Get brand knowledge",
    description: "Reads approved brand knowledge records only.",
    riskLevel: "READ_ONLY",
    readOnly: true,
  },
  {
    key: AGENT_TOOL_KEYS.LIST_CONTENT_ITEMS,
    name: "List content items",
    description: "Lists content items in draft or approved states.",
    riskLevel: "READ_ONLY",
    readOnly: true,
  },
  {
    key: AGENT_TOOL_KEYS.GET_LEAD_SUMMARY,
    name: "Get lead summary",
    description: "Reads lead records within tenant scope.",
    riskLevel: "READ_ONLY",
    readOnly: true,
  },
  {
    key: AGENT_TOOL_KEYS.LIST_CAMPAIGN_KPIS,
    name: "List campaign KPIs",
    description: "Reads campaign KPI targets and progress inputs.",
    riskLevel: "READ_ONLY",
    readOnly: true,
  },
];

export function getToolDefinition(toolKey: string): AgentToolDefinition | undefined {
  return AGENT_TOOL_DEFINITIONS.find((tool) => tool.key === toolKey);
}

export function isToolAllowedForAgent(agentAllowedTools: string[], toolKey: string): boolean {
  return agentAllowedTools.includes(toolKey);
}
