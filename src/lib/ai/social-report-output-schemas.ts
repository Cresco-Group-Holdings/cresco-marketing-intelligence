import { z } from "zod";

export const socialReportNarrativeSchema = z.object({
  executiveSummary: z.string().min(1).max(4000),
  keyImprovements: z.array(z.string().min(1).max(500)).max(8),
  keyDeclines: z.array(z.string().min(1).max(500)).max(8),
  notableContent: z.array(z.string().min(1).max(500)).max(8),
  recommendedActions: z.array(z.string().min(1).max(500)).max(8),
  dataLimitations: z.array(z.string().min(1).max(500)).max(12),
});

export type SocialReportNarrative = z.infer<typeof socialReportNarrativeSchema>;

export const SOCIAL_REPORT_OUTPUT_SCHEMAS = {
  "social.report.narrative": socialReportNarrativeSchema,
} as const;
