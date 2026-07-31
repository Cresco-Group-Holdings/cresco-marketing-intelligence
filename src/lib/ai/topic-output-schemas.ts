import { z } from "zod";

export const topicClusterAiSchema = z.object({
  clusterName: z.string(),
  strategicRationale: z.string(),
  pillarStructure: z.array(
    z.object({
      title: z.string(),
      formatType: z.string(),
      funnelStage: z.string().optional(),
    }),
  ),
  supportingSequence: z.array(
    z.object({
      title: z.string(),
      formatType: z.string(),
      sequenceOrder: z.number(),
    }),
  ),
  audienceQuestions: z.array(z.string()),
  differentiationAngle: z.string(),
  recommendedOrder: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({ type: z.string(), detail: z.string() })),
  limitations: z.string(),
});

export const TOPIC_OUTPUT_SCHEMAS = {
  "seo.topics.strategy": topicClusterAiSchema,
} as const;
