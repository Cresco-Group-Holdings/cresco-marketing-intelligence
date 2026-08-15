import { z } from "zod";
import { CRM_LEAD_WORKFLOW_STATUSES } from "@/lib/crm/lead-workflow";

export const transitionLeadSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(CRM_LEAD_WORKFLOW_STATUSES),
  reason: z.string().max(500).optional(),
});

export const qualificationAssessmentSchema = z.object({
  leadId: z.string().min(1),
  outcome: z.enum(["UNASSESSED", "IN_PROGRESS", "QUALIFIED", "DISQUALIFIED"]),
  criteria: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
});

export const consentRecordSchema = z.object({
  leadId: z.string().min(1),
  channel: z.string().min(1).max(64),
  status: z.enum(["GRANTED", "DENIED", "WITHDRAWN", "UNKNOWN"]),
  lawfulBasis: z
    .enum([
      "CONSENT",
      "LEGITIMATE_INTEREST",
      "CONTRACT",
      "LEGAL_OBLIGATION",
      "VITAL_INTEREST",
      "PUBLIC_TASK",
      "OTHER",
    ])
    .optional(),
  marketingOptIn: z.boolean().optional(),
  suppressed: z.boolean().optional(),
  contactEligible: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export const manualScoreSchema = z.object({
  leadId: z.string().min(1),
  score: z.number().int().min(0).max(1000),
  maxScore: z.number().int().min(1).max(1000).optional(),
  rationale: z.string().max(2000).optional(),
  criteria: z.record(z.string(), z.unknown()).optional(),
});

export const duplicateDetectionSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  externalProvider: z.string().optional(),
  externalId: z.string().optional(),
});

export const archiveLeadSchema = z.object({
  leadId: z.string().min(1),
  reason: z.string().max(500).optional(),
});
