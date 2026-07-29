import {
  SocialConversationStatus,
  SocialConversationType,
  SocialInboxPriority,
  SocialProvider,
  SocialSafetyFlag,
} from "@prisma/client";
import { z } from "zod";
import {
  INBOX_DEFAULT_LIST_LIMIT,
  INBOX_MAX_LIST_LIMIT,
  INBOX_MAX_REPLY_LENGTH,
  INBOX_MAX_TAG_LENGTH,
} from "@/lib/inbox/constants";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const inboxListFiltersSchema = z.object({
  status: z.nativeEnum(SocialConversationStatus).optional(),
  priority: z.nativeEnum(SocialInboxPriority).optional(),
  conversationType: z.nativeEnum(SocialConversationType).optional(),
  provider: z.nativeEnum(SocialProvider).optional(),
  socialAccountId: z.string().optional(),
  assignedToUserId: z.string().optional(),
  unreadOnly: z.coerce.boolean().optional(),
  requiresHumanReview: z.coerce.boolean().optional(),
  safetyFlag: z.nativeEnum(SocialSafetyFlag).optional(),
  tag: optionalTrimmed(INBOX_MAX_TAG_LENGTH),
  search: optionalTrimmed(200),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(INBOX_MAX_LIST_LIMIT)
    .default(INBOX_DEFAULT_LIST_LIMIT),
});

export const inboxReplySchema = z.object({
  body: z.string().trim().min(1).max(INBOX_MAX_REPLY_LENGTH),
  idempotencyKey: z.string().min(12).max(160),
});

export const inboxAssignSchema = z.object({
  assignedToUserId: z.string(),
  note: optionalTrimmed(1000),
});

export const inboxTagSchema = z.object({
  tag: z.string().trim().min(1).max(INBOX_MAX_TAG_LENGTH),
});

export const inboxStatusUpdateSchema = z.object({
  status: z.nativeEnum(SocialConversationStatus),
  reason: optionalTrimmed(1000),
});

export const inboxDraftSchema = z.object({
  body: z.string().trim().min(1).max(INBOX_MAX_REPLY_LENGTH),
  tone: optionalTrimmed(100),
});

export const inboxAiSuggestSchema = z.object({
  instruction: optionalTrimmed(2000),
  tone: optionalTrimmed(100),
  provider: z.enum(["MOCK", "OPENAI", "ANTHROPIC", "GOOGLE"]).optional(),
  model: z.string().max(100).optional(),
});

export type InboxListFiltersInput = z.infer<typeof inboxListFiltersSchema>;
export type InboxReplyInput = z.infer<typeof inboxReplySchema>;
export type InboxAssignInput = z.infer<typeof inboxAssignSchema>;
export type InboxTagInput = z.infer<typeof inboxTagSchema>;
export type InboxStatusUpdateInput = z.infer<typeof inboxStatusUpdateSchema>;
export type InboxDraftInput = z.infer<typeof inboxDraftSchema>;
export type InboxAiSuggestInput = z.infer<typeof inboxAiSuggestSchema>;
