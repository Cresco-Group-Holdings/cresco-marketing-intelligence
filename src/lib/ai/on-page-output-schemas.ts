import { z } from "zod";

const evidenceRefSchema = z.object({
  source: z.string(),
  key: z.string(),
  value: z.unknown(),
  observedAt: z.string().optional(),
});

export const onPageSemanticReviewSchema = z.object({
  findings: z.array(
    z.object({
      category: z.enum(["SEMANTIC", "KEYWORD", "READABILITY"]),
      title: z.string(),
      description: z.string(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "BLOCKING"]),
      evidence: z.array(evidenceRefSchema).min(1),
      recommendationType: z.string().optional(),
    }),
  ),
  intentAlignment: z.object({
    score: z.number().min(0).max(1),
    note: z.string(),
    evidence: z.array(evidenceRefSchema).min(1),
  }),
  topicCompleteness: z.object({
    covered: z.array(z.string()),
    missing: z.array(z.string()),
    evidence: z.array(evidenceRefSchema).min(1),
  }),
  limitations: z.array(z.string()),
  disclaimer: z.string(),
});

export const ON_PAGE_OUTPUT_SCHEMAS = {
  "onPage.semantic.review": onPageSemanticReviewSchema,
} as const;
