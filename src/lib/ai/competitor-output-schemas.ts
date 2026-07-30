import { z } from "zod";

export const competitorAiAnalysisSchema = z.object({
  coverageDifferences: z.array(z.string()),
  opportunities: z.array(
    z.object({
      title: z.string(),
      explanation: z.string(),
      confidence: z.number().min(0).max(1),
      recommendedAction: z.string(),
      originalityGuidance: z.string(),
    }),
  ),
  differentiatingAngles: z.array(z.string()),
  audienceQuestions: z.array(z.string()),
  limitations: z.string(),
  evidence: z.array(z.object({ type: z.string(), detail: z.string() })),
});

export const COMPETITOR_OUTPUT_SCHEMAS = {
  "seo.competitors.analyze": competitorAiAnalysisSchema,
} as const;
