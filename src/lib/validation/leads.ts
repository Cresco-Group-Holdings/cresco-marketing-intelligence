import {
  CrmProvider,
  LeadConsentState,
  LeadCreationSource,
  LeadQualificationProfile,
  MarketingLeadStatus,
  SocialProvider,
} from "@prisma/client";
import { z } from "zod";
import {
  LEAD_DEFAULT_LIST_LIMIT,
  LEAD_MAX_INTEREST_LENGTH,
  LEAD_MAX_LIST_LIMIT,
  LEAD_MAX_NOTE_LENGTH,
} from "@/lib/leads/constants";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const leadListFiltersSchema = z.object({
  status: z.nativeEnum(MarketingLeadStatus).optional(),
  creationSource: z.nativeEnum(LeadCreationSource).optional(),
  provider: z.nativeEnum(SocialProvider).optional(),
  assignedToUserId: z.string().optional(),
  qualificationProfile: z.nativeEnum(LeadQualificationProfile).optional(),
  qualifiedOnly: z.coerce.boolean().optional(),
  duplicateWarning: z.coerce.boolean().optional(),
  search: optionalTrimmed(200),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(LEAD_MAX_LIST_LIMIT).default(LEAD_DEFAULT_LIST_LIMIT),
});

export const leadCreateSchema = z.object({
  creationSource: z.nativeEnum(LeadCreationSource),
  displayName: optionalTrimmed(200),
  providerUsername: optionalTrimmed(200),
  providerProfileUrl: optionalTrimmed(500),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalTrimmed(40),
  company: optionalTrimmed(200),
  jobRole: optionalTrimmed(200),
  country: optionalTrimmed(100),
  expressedInterest: optionalTrimmed(LEAD_MAX_INTEREST_LENGTH),
  sourcePlatform: z.nativeEnum(SocialProvider).optional(),
  sourcePostId: optionalTrimmed(200),
  sourceCampaign: optionalTrimmed(200),
  originalInteraction: optionalTrimmed(LEAD_MAX_INTEREST_LENGTH),
  socialConversationId: z.string().optional(),
  socialAccountId: z.string().optional(),
  contentItemId: z.string().optional(),
  primaryCta: optionalTrimmed(200),
  destinationUrl: optionalTrimmed(500),
  conversionEventId: optionalTrimmed(200),
  firstInteractionAt: z.string().datetime().optional(),
  latestInteractionAt: z.string().datetime().optional(),
  lawfulBasisPlaceholder: optionalTrimmed(500),
  consentState: z.nativeEnum(LeadConsentState).optional(),
  marketingOptIn: z.coerce.boolean().optional(),
});

export const leadUpdateSchema = z.object({
  status: z.nativeEnum(MarketingLeadStatus).optional(),
  displayName: optionalTrimmed(200),
  providerUsername: optionalTrimmed(200),
  providerProfileUrl: optionalTrimmed(500),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalTrimmed(40),
  company: optionalTrimmed(200),
  jobRole: optionalTrimmed(200),
  country: optionalTrimmed(100),
  expressedInterest: optionalTrimmed(LEAD_MAX_INTEREST_LENGTH),
  assignedToUserId: z.string().optional().nullable(),
});

export const leadAssignSchema = z.object({
  assignedToUserId: z.string(),
  note: optionalTrimmed(LEAD_MAX_NOTE_LENGTH),
});

export const leadQualificationSchema = z.object({
  profile: z.nativeEnum(LeadQualificationProfile),
  answers: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])),
  qualified: z.boolean().optional(),
  reviewNotes: optionalTrimmed(LEAD_MAX_NOTE_LENGTH),
});

export const leadConsentSchema = z.object({
  consentState: z.nativeEnum(LeadConsentState),
  lawfulBasis: optionalTrimmed(500),
  marketingOptIn: z.coerce.boolean().optional(),
  suppressed: z.coerce.boolean().optional(),
  notes: optionalTrimmed(LEAD_MAX_NOTE_LENGTH),
});

export const leadCrmHandoffSchema = z.object({
  provider: z.nativeEnum(CrmProvider),
  idempotencyKey: z.string().min(12).max(160),
  webhookUrl: z.string().url().optional(),
});

export const leadExportSchema = z.object({
  format: z.enum(["CSV", "JSON"]).default("CSV"),
  status: z.nativeEnum(MarketingLeadStatus).optional(),
  qualifiedOnly: z.coerce.boolean().optional(),
});

export const leadAiQualificationSchema = z.object({
  profile: z.nativeEnum(LeadQualificationProfile),
  instruction: optionalTrimmed(2000),
});

export const leadNoteSchema = z.object({
  note: z.string().trim().min(1).max(LEAD_MAX_NOTE_LENGTH),
});

export type LeadListFiltersInput = z.infer<typeof leadListFiltersSchema>;
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
