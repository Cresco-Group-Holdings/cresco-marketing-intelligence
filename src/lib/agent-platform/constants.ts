export const AGENT_KEYS = {
  CAMPAIGN_STRATEGIST: "campaign_strategist",
  CONTENT_PLANNER: "content_planner",
  MARKETING_ANALYST: "marketing_analyst",
  BRAND_COMPLIANCE_REVIEWER: "brand_compliance_reviewer",
  LEAD_QUALIFICATION_ASSISTANT: "lead_qualification_assistant",
  ADVERTISING_OPTIMISATION_ADVISOR: "advertising_optimisation_advisor",
} as const;

export type AgentKey = (typeof AGENT_KEYS)[keyof typeof AGENT_KEYS];

export const AGENT_TOOL_KEYS = {
  GET_CAMPAIGN_SUMMARY: "get_campaign_summary",
  GET_ANALYTICS_METRICS: "get_analytics_metrics",
  GET_BRAND_KNOWLEDGE: "get_brand_knowledge",
  LIST_CONTENT_ITEMS: "list_content_items",
  GET_LEAD_SUMMARY: "get_lead_summary",
  LIST_CAMPAIGN_KPIS: "list_campaign_kpis",
} as const;

export type AgentToolKey = (typeof AGENT_TOOL_KEYS)[keyof typeof AGENT_TOOL_KEYS];

export const HIGH_IMPACT_ACTION_KEYS = new Set([
  "publish_content",
  "activate_campaign",
  "adjust_budget",
  "send_outreach",
  "delete_record",
  "spend_budget",
]);

export const AGENT_DEFAULT_DAILY_RUN_LIMIT = 100;
export const AGENT_DEFAULT_DAILY_TOKEN_LIMIT = 500_000;
export const AGENT_DEFAULT_DAILY_COST_LIMIT_USD = 25;

export const AGENT_MODEL_RETRY_ATTEMPTS = 3;
export const AGENT_MODEL_RETRY_BASE_MS = 500;

export const AGENT_EVALUATION_CRITERIA = {
  TENANT_SCOPE: "tenant_scope",
  RBAC_COMPLIANCE: "rbac_compliance",
  NO_SECRETS: "no_secrets",
  NO_FABRICATED_DATA: "no_fabricated_data",
  APPROVAL_GATES: "approval_gates",
  KNOWLEDGE_AUTHORITY: "knowledge_authority",
} as const;
