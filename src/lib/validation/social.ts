import { z } from "zod";
import { SocialProvider } from "@prisma/client";

export const socialProviderSchema = z.nativeEnum(SocialProvider);

export const assignSocialAccountSchema = z.object({
  providerAccountId: z.string().min(1),
});

export const socialOAuthCallbackSchema = z.object({
  state: z.string().min(1),
  code: z.string().min(1),
});
