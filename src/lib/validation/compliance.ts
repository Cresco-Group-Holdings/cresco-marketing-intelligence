import { CompliancePolicyCategory } from "@prisma/client";
import { z } from "zod";

export const compliancePolicyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  category: z.nativeEnum(CompliancePolicyCategory),
  description: z.string().max(4000).optional(),
  templateKey: z.string().max(120).optional(),
});

export const complianceOverrideSchema = z.object({
  findingId: z.string(),
  reason: z.string().min(10).max(2000),
  expiresAt: z.string().datetime().optional(),
});

export const complianceDismissSchema = z.object({
  findingId: z.string(),
  reason: z.string().min(5).max(2000),
});

export const complianceEvaluateSchema = z.object({
  contentVariantId: z.string().optional(),
  includeAiReview: z.coerce.boolean().optional(),
});

export type ComplianceOverrideInput = z.infer<typeof complianceOverrideSchema>;
export type ComplianceDismissInput = z.infer<typeof complianceDismissSchema>;
export type ComplianceEvaluateInput = z.infer<typeof complianceEvaluateSchema>;
