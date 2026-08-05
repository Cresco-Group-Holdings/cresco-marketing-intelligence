import { z } from "zod";

export const agentPlatformResponseSchema = z.object({
  summary: z.string(),
  analysis: z.array(z.string()).default([]),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        rationale: z.string().optional(),
      }),
    )
    .default([]),
  proposedActions: z
    .array(
      z.object({
        actionKey: z.string(),
        title: z.string(),
        description: z.string(),
        payload: z.record(z.string(), z.unknown()).default({}),
        riskLevel: z.enum(["DRAFT", "HIGH_IMPACT"]).default("DRAFT"),
      }),
    )
    .default([]),
  limitations: z.array(z.string()).default([]),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export type AgentPlatformResponse = z.infer<typeof agentPlatformResponseSchema>;

export const AGENT_OUTPUT_SCHEMAS = {
  "agent.platform_response": agentPlatformResponseSchema,
} as const;
