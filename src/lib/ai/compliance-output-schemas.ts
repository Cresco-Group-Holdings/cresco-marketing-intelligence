import { z } from "zod";

export const complianceAiFindingSchema = z.object({
  excerpt: z.string().min(1).max(500),
  ruleReference: z.string().min(1).max(200),
  riskLevel: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "BLOCKING"]),
  explanation: z.string().min(1).max(2000),
  suggestedCorrection: z.string().max(2000).optional(),
  category: z.string().min(1).max(80),
});

export const complianceAiReviewSchema = z.object({
  summary: z.string().min(1).max(2000),
  findings: z.array(complianceAiFindingSchema),
  requiresHumanReview: z.literal(true),
});

export type ComplianceAiReview = z.infer<typeof complianceAiReviewSchema>;

export const COMPLIANCE_OUTPUT_SCHEMAS = {
  complianceAiReview: complianceAiReviewSchema,
} as const;
