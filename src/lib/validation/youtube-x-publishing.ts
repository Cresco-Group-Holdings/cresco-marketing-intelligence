import { z } from "zod";

const common = z.object({
  contentVariantId: z.string(),
  socialAccountId: z.string(),
  confirmed: z.literal(true),
  idempotencyKey: z.string().min(12).max(120),
});

export const youtubePublishSchema = common.extend({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(5_000),
  tags: z.array(z.string().max(100)).max(50),
  categoryId: z.string().min(1).max(10),
  privacyStatus: z.enum(["private", "unlisted", "public"]),
  madeForKids: z.boolean(),
  rightsConfirmed: z.literal(true),
  scheduledPublishAt: z.string().datetime().optional(),
});

export const xPublishSchema = common.extend({
  posts: z.array(z.string().trim().min(1).max(280)).min(1).max(25),
  entitlementConfirmed: z.literal(true),
  replyToId: z.string().optional(),
});
