import { z } from "zod";

export const checkoutSchema = z.object({
  planKey: z.string().min(1),
  billingInterval: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  promoCode: z.string().optional(),
});

export const changePlanSchema = z.object({
  planKey: z.string().min(1),
  billingInterval: z.enum(["MONTHLY", "ANNUAL"]).optional(),
});

export const portalSchema = z.object({
  returnUrl: z.string().url(),
});

export const entitlementCheckSchema = z.object({
  entitlement: z.string().min(1),
  requestedAmount: z.number().int().positive().optional(),
});
