import { z } from "zod";

export const instagramImmediatePublishSchema = z.object({
  contentVariantId: z.string(),
  socialAccountId: z.string(),
  confirmed: z.literal(true, { error: "Final publish confirmation is required." }),
  idempotencyKey: z.string().trim().min(12).max(120),
});
