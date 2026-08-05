export const agentsFeature = {
  name: "agents",
  status: "active",
  path: "/agents",
  api: {
    definitions: "/api/agents/definitions",
    runs: "/api/agents/runs",
    approvals: "/api/agents/approvals",
  },
  initialAgents: [
    "campaign_strategist",
    "content_planner",
    "marketing_analyst",
    "brand_compliance_reviewer",
    "lead_qualification_assistant",
    "advertising_optimisation_advisor",
  ],
};
