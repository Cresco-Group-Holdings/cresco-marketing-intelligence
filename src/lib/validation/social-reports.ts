import {
  SocialProvider,
  SocialReportExportFormat,
  SocialReportScheduleCadence,
  SocialReportSectionType,
  SocialReportType,
} from "@prisma/client";
import { z } from "zod";
import { isSupportedTimeZone } from "@/lib/analytics/timezone";

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine(isSupportedTimeZone, "Unsupported analytics timezone identifier.");

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const socialReportCreateSchema = z.object({
  reportType: z.nativeEnum(SocialReportType),
  title: z.string().trim().min(1).max(200),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  timezone,
  accountIds: z.array(z.string()).max(50).optional(),
  enabledSections: z.array(z.nativeEnum(SocialReportSectionType)).max(20).optional(),
  selectedMetrics: z.array(z.string().max(80)).max(30).optional(),
  customNotes: optionalTrimmed(5000),
  includeRecommendations: z.coerce.boolean().optional(),
  includeCrescoBranding: z.coerce.boolean().optional(),
  generateNarrative: z.coerce.boolean().optional(),
  provider: z.nativeEnum(SocialProvider).optional(),
  campaign: z.string().max(200).optional(),
});

export const socialReportUpdateSchema = socialReportCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field must be provided." },
);

export const socialReportShareSchema = z.object({
  enable: z.coerce.boolean(),
  expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
});

export const socialReportExportSchema = z.object({
  format: z.nativeEnum(SocialReportExportFormat),
});

export const socialReportScheduleSchema = z.object({
  reportType: z.nativeEnum(SocialReportType),
  cadence: z.nativeEnum(SocialReportScheduleCadence),
  timezone,
  accountIds: z.array(z.string()).max(50).optional(),
  enabledSections: z.array(z.nativeEnum(SocialReportSectionType)).max(20).optional(),
  includeRecommendations: z.coerce.boolean().optional(),
  includeCrescoBranding: z.coerce.boolean().optional(),
  recipientEmails: z.array(z.string().email()).max(20),
  recipientUserIds: z.array(z.string()).max(20).optional(),
});

export type SocialReportCreateInput = z.infer<typeof socialReportCreateSchema>;
export type SocialReportScheduleInput = z.infer<typeof socialReportScheduleSchema>;
