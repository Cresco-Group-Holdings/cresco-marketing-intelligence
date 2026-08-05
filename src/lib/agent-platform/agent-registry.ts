import type { Permission } from "@/lib/tenancy/permissions";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { AGENT_KEYS, AGENT_TOOL_KEYS } from "@/lib/agent-platform/constants";

export type AgentDefinition = {
  key: string;
  name: string;
  description: string;
  category: string;
  requiredPermissions: Permission[];
  allowedTools: string[];
  promptTemplateKey: string;
  outputSchemaKey: string;
  supportsProposedActions: boolean;
};

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    key: AGENT_KEYS.CAMPAIGN_STRATEGIST,
    name: "Campaign Strategist",
    description: "Analyses campaigns and proposes strategic recommendations.",
    category: "campaigns",
    requiredPermissions: [PERMISSIONS["campaign.read"], PERMISSIONS["ai.agent.run"]],
    allowedTools: [
      AGENT_TOOL_KEYS.GET_CAMPAIGN_SUMMARY,
      AGENT_TOOL_KEYS.LIST_CAMPAIGN_KPIS,
      AGENT_TOOL_KEYS.GET_ANALYTICS_METRICS,
      AGENT_TOOL_KEYS.GET_BRAND_KNOWLEDGE,
    ],
    promptTemplateKey: "agent.campaign_strategist",
    outputSchemaKey: "agent.platform_response",
    supportsProposedActions: true,
  },
  {
    key: AGENT_KEYS.CONTENT_PLANNER,
    name: "Content Planner",
    description: "Drafts content plans based on brand knowledge and calendar context.",
    category: "content",
    requiredPermissions: [PERMISSIONS["content.read"], PERMISSIONS["ai.agent.run"]],
    allowedTools: [
      AGENT_TOOL_KEYS.GET_BRAND_KNOWLEDGE,
      AGENT_TOOL_KEYS.LIST_CONTENT_ITEMS,
      AGENT_TOOL_KEYS.GET_CAMPAIGN_SUMMARY,
    ],
    promptTemplateKey: "agent.content_planner",
    outputSchemaKey: "agent.platform_response",
    supportsProposedActions: true,
  },
  {
    key: AGENT_KEYS.MARKETING_ANALYST,
    name: "Marketing Analyst",
    description: "Explains performance trends from authorised analytics facts only.",
    category: "analytics",
    requiredPermissions: [PERMISSIONS["analytics.read"], PERMISSIONS["ai.agent.run"]],
    allowedTools: [AGENT_TOOL_KEYS.GET_ANALYTICS_METRICS, AGENT_TOOL_KEYS.GET_CAMPAIGN_SUMMARY],
    promptTemplateKey: "agent.marketing_analyst",
    outputSchemaKey: "agent.platform_response",
    supportsProposedActions: false,
  },
  {
    key: AGENT_KEYS.BRAND_COMPLIANCE_REVIEWER,
    name: "Brand Compliance Reviewer",
    description: "Reviews drafts against brand compliance rules and knowledge.",
    category: "compliance",
    requiredPermissions: [PERMISSIONS["compliance.read"], PERMISSIONS["ai.agent.run"]],
    allowedTools: [AGENT_TOOL_KEYS.GET_BRAND_KNOWLEDGE, AGENT_TOOL_KEYS.LIST_CONTENT_ITEMS],
    promptTemplateKey: "agent.brand_compliance_reviewer",
    outputSchemaKey: "agent.platform_response",
    supportsProposedActions: true,
  },
  {
    key: AGENT_KEYS.LEAD_QUALIFICATION_ASSISTANT,
    name: "Lead Qualification Assistant",
    description: "Analyses leads and proposes qualification guidance.",
    category: "crm",
    requiredPermissions: [PERMISSIONS["leads.read"], PERMISSIONS["ai.agent.run"]],
    allowedTools: [AGENT_TOOL_KEYS.GET_LEAD_SUMMARY, AGENT_TOOL_KEYS.GET_BRAND_KNOWLEDGE],
    promptTemplateKey: "agent.lead_qualification_assistant",
    outputSchemaKey: "agent.platform_response",
    supportsProposedActions: true,
  },
  {
    key: AGENT_KEYS.ADVERTISING_OPTIMISATION_ADVISOR,
    name: "Advertising Optimisation Advisor",
    description: "Recommends advertising optimisations without spending budget.",
    category: "advertising",
    requiredPermissions: [PERMISSIONS["advertisingPlans.read"], PERMISSIONS["ai.agent.run"]],
    allowedTools: [
      AGENT_TOOL_KEYS.GET_ANALYTICS_METRICS,
      AGENT_TOOL_KEYS.GET_CAMPAIGN_SUMMARY,
      AGENT_TOOL_KEYS.LIST_CAMPAIGN_KPIS,
    ],
    promptTemplateKey: "agent.advertising_optimisation_advisor",
    outputSchemaKey: "agent.platform_response",
    supportsProposedActions: true,
  },
];

export function getAgentDefinition(agentKey: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((definition) => definition.key === agentKey);
}

export function listAgentDefinitions() {
  return AGENT_DEFINITIONS;
}
