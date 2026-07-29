import { z } from "zod";

const evidenceRefSchema = z.object({
  evidenceKey: z.string(),
  evidenceLabel: z.string().optional(),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]).optional(),
});

export const growthInsightExplanationSchema = z.object({
  finding: z.string().min(1).max(2000),
  explanation: z.string().min(1).max(4000),
  recommendedAction: z.string().min(1).max(2000),
  evidence: z.array(evidenceRefSchema).min(1).max(20),
  expectedHypothesis: z.string().min(1).max(1000),
  measurementPlan: z.string().min(1).max(2000),
});

export type GrowthInsightExplanation = z.infer<typeof growthInsightExplanationSchema>;

export const GROWTH_OUTPUT_SCHEMAS = {
  "growth.insight.explain": growthInsightExplanationSchema,
} as const;

export type GrowthOutputSchemaKey = keyof typeof GROWTH_OUTPUT_SCHEMAS;
