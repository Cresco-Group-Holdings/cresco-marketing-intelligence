import { z } from "zod";

const common = z.object({
  contentVariantId: z.string(),
  socialAccountId: z.string(),
  confirmed: z.literal(true),
  idempotencyKey: z.string().min(12).max(120),
});

export const linkedInPublishSchema = common.extend({
  authorType: z.enum(["MEMBER", "ORGANISATION"]),
  authorId: z.string().min(1).max(200),
});

export const facebookPublishSchema = common.extend({
  pageId: z.string().min(1).max(200),
  publishAsReel: z.boolean().default(false),
});
