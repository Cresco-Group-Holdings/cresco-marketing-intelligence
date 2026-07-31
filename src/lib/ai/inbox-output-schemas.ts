import { z } from "zod";

export const inboxReplySuggestionSchema = z.object({
  replyText: z.string().min(1).max(5000),
  tone: z.string().max(100).optional(),
  complianceNotes: z.array(z.string().max(500)).max(10).optional(),
});

export type InboxReplySuggestionOutput = z.infer<typeof inboxReplySuggestionSchema>;

export const INBOX_OUTPUT_SCHEMAS = {
  "inbox.reply.suggest": inboxReplySuggestionSchema,
} as const;

export type InboxOutputSchemaKey = keyof typeof INBOX_OUTPUT_SCHEMAS;
