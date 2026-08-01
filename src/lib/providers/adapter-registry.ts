import { providerCredentialService } from "@/server/services/provider-credential-service";
import { createResendAdapter } from "@/server/providers/resend/resend-adapter";
import type { ProviderCapabilityType } from "@prisma/client";
import type { ProviderAdapterUnion } from "@/lib/providers/adapter-contracts";
import { isWebhookProviderAdapter } from "@/lib/providers/adapter-contracts";

let cachedResendBundle: ReturnType<typeof createResendAdapter> | null = null;

function getResendBundle() {
  if (!cachedResendBundle) {
    cachedResendBundle = createResendAdapter({
      getApiKey: async (context) =>
        providerCredentialService.getCredentialPlaintext(context.connectionId, "API_KEY"),
      getWebhookSecret: async (context) =>
        providerCredentialService.getCredentialPlaintext(context.connectionId, "WEBHOOK_SIGNING_SECRET"),
    });
  }
  return cachedResendBundle;
}

export function resolveProviderAdapter(
  providerKey: string,
  _capability?: ProviderCapabilityType,
): ProviderAdapterUnion | null {
  if (providerKey === "resend") {
    return getResendBundle().adapter;
  }
  return null;
}

export function resolveWebhookAdapter(providerKey: string) {
  if (providerKey === "resend") {
    return getResendBundle().webhookAdapter;
  }
  return null;
}

export function resetProviderAdapterCacheForTests() {
  cachedResendBundle = null;
}

export { isWebhookProviderAdapter };
