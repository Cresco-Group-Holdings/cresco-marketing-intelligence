import { z } from "zod";

const evidenceRefSchema = z.object({
  evidenceKey: z.string(),
  evidenceLabel: z.string().optional(),
  value: z.union([z.number(), z.string(), z.null()]).optional(),
  claimType: z.enum([
    "MEASURED_FACT",
    "DETERMINISTIC_CALCULATION",
    "CORRELATION",
    "HYPOTHESIS",
    "RECOMMENDATION",
    "UNAVAILABLE",
  ]),
});

const findingSchema = z.object({
  statement: z.string().min(1).max(2000),
  claimType: z.enum([
    "MEASURED_FACT",
    "DETERMINISTIC_CALCULATION",
    "CORRELATION",
    "HYPOTHESIS",
    "RECOMMENDATION",
    "UNAVAILABLE",
  ]),
  evidenceKeys: z.array(z.string()).min(1).max(10),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

const recommendedActionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(2000),
  actionType: z.enum([
    "CONTENT_BRIEF",
    "EXPERIMENT",
    "CAMPAIGN_TASK",
    "DATA_QUALITY_TASK",
    "CONNECTOR_RECOVERY_TASK",
    "LANDING_PAGE_REVIEW",
    "OBJECTIVE_UPDATE_PROPOSAL",
  ]),
  priority: z.number().int().min(1).max(3),
  measurementPlan: z.string().min(1).max(2000),
});

export const marketingAnalystOutputSchema = z.object({
  summary: z.string().min(1).max(4000),
  keyFindings: z.array(findingSchema).min(1).max(15),
  evidenceReferences: z.array(evidenceRefSchema).min(1).max(30),
  possibleExplanations: z.array(z.object({
    explanation: z.string().min(1).max(2000),
    claimType: z.enum(["CORRELATION", "HYPOTHESIS"]),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  })).max(10),
  recommendedActions: z.array(recommendedActionSchema).max(10),
  measurementPlan: z.string().min(1).max(2000),
  limitations: z.array(z.string()).max(20),
  unavailableData: z.array(z.string()).max(30),
});

export type MarketingAnalystOutput = z.infer<typeof marketingAnalystOutputSchema>;

export const ANALYST_OUTPUT_SCHEMAS = {
  "analyst.marketing.analyze": marketingAnalystOutputSchema,
} as const;

export type AnalystOutputSchemaKey = keyof typeof ANALYST_OUTPUT_SCHEMAS;
