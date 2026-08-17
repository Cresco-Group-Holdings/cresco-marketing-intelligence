import { z } from "zod";

export const copilotSynthesisOutputSchema = z.object({
  summary: z.string().min(1).max(2000),
  factStatements: z.array(z.string().min(1).max(500)).max(8),
  inferenceStatements: z.array(z.string().min(1).max(500)).max(5),
  recommendationStatements: z.array(z.string().min(1).max(500)).max(5),
  followUpQuestions: z.array(z.string().min(1).max(200)).max(4),
});

export type CopilotSynthesisOutput = z.infer<typeof copilotSynthesisOutputSchema>;

export const COPILOT_OUTPUT_SCHEMAS = {
  "copilot.synthesis": copilotSynthesisOutputSchema,
} as const;
