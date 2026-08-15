import { z } from "zod";
import { AGENT_KEYS } from "@/lib/agent-platform/constants";

const agentKeySchema = z.enum([
  AGENT_KEYS.CAMPAIGN_STRATEGIST,
  AGENT_KEYS.CONTENT_PLANNER,
  AGENT_KEYS.MARKETING_ANALYST,
  AGENT_KEYS.BRAND_COMPLIANCE_REVIEWER,
  AGENT_KEYS.LEAD_QUALIFICATION_ASSISTANT,
  AGENT_KEYS.ADVERTISING_OPTIMISATION_ADVISOR,
]);

export const agentRunInputSchema = z.object({
  agentKey: agentKeySchema,
  userInput: z.string().min(1).max(8000),
  projectId: z.string().optional(),
  brandId: z.string().optional(),
  campaignId: z.string().optional(),
  modelId: z.string().optional(),
});

export const agentApprovalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(2000).optional(),
});

export type AgentRunInput = z.infer<typeof agentRunInputSchema>;
export type AgentApprovalDecisionInput = z.infer<typeof agentApprovalDecisionSchema>;
