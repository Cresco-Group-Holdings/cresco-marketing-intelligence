import { z } from "zod";

export const connectProviderSchema = z.object({
  returnPath: z.string().optional(),
  requestedScopes: z.array(z.string()).optional(),
  connectionId: z.string().optional(),
});

export const selectAccountsSchema = z.object({
  externalAccountIds: z.array(z.string()).min(1),
});

export const apiKeyCredentialSchema = z.object({
  providerKey: z.string().min(1),
  apiKey: z.string().min(1),
  displayName: z.string().optional(),
  connectionId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const serviceAccountCredentialSchema = z.object({
  providerKey: z.string().min(1),
  serviceAccountJson: z.string().min(1),
  displayName: z.string().optional(),
  connectionId: z.string().optional(),
});

export const reconnectSchema = z.object({
  returnPath: z.string().optional(),
});
