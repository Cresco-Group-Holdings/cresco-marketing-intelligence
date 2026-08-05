import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const featureFlagSchema = z.object({
  key: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  enabled: z.boolean(),
});

export const supportAccessSchema = z.object({
  targetUserId: z.string().min(1),
  targetOrgId: z.string().optional(),
  reason: z.string().min(10).max(1000),
  durationMinutes: z.number().int().min(5).max(240).optional(),
});

export const dataDeletionRequestSchema = z.object({
  organisationId: z.string().min(1),
  subjectEmail: z.string().email().optional(),
  reason: z.string().max(1000).optional(),
});

export const retentionPolicySchema = z.object({
  resourceType: z.string().min(1),
  retentionDays: z.number().int().min(1),
  anonymiseAfter: z.number().int().min(1).optional(),
});
