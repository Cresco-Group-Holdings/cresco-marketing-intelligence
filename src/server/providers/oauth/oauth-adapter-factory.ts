import { AppError } from "@/lib/errors";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import { isProductionOAuthProvider } from "@/lib/providers/oauth/production-providers";
import { getProviderOAuthConfigDetail } from "@/lib/providers/oauth/provider-config";
import { isOAuthMockAllowed } from "@/lib/providers/oauth/runtime";
import type { ProviderOAuthAdapter } from "@/lib/providers/oauth/types";
import { createMockOAuthAdapter } from "@/server/providers/oauth/adapters/mock-oauth-adapter";
import { metaAdsOAuthAdapter, metaOAuthAdapter } from "@/server/providers/oauth/adapters/meta-oauth-adapter";

const REAL_ADAPTERS: Record<string, ProviderOAuthAdapter> = {
  meta: metaOAuthAdapter,
  "meta-ads": metaAdsOAuthAdapter,
};

export function resolveProviderOAuthAdapter(providerKey: string): ProviderOAuthAdapter {
  const definition = getOAuthProviderDefinition(providerKey);
  if (!definition) {
    throw new AppError("NOT_FOUND", `Unknown OAuth provider: ${providerKey}`);
  }

  if (isProductionOAuthProvider(providerKey)) {
    const config = getProviderOAuthConfigDetail(providerKey);
    if (config.status === "READY") {
      const adapter = REAL_ADAPTERS[providerKey];
      if (!adapter) {
        throw new AppError("AUTH_CONFIGURATION_ERROR", `OAuth adapter missing for ${providerKey}.`);
      }
      return adapter;
    }

    if (isOAuthMockAllowed()) {
      return createMockOAuthAdapter(providerKey);
    }

    throw new AppError(
      "AUTH_CONFIGURATION_ERROR",
      `Provider "${providerKey}" OAuth is misconfigured. Missing: ${config.missingEnv.join(", ") || "credentials"}.`,
    );
  }

  if (isOAuthMockAllowed()) {
    return createMockOAuthAdapter(providerKey);
  }

  throw new AppError(
    "VALIDATION_ERROR",
    `OAuth provider "${providerKey}" is not production-enabled. Set ALLOW_OAUTH_MOCK=true for local mock connect.`,
  );
}

export function isAdapterUsingMock(providerKey: string): boolean {
  try {
    const adapter = resolveProviderOAuthAdapter(providerKey);
    return adapter.getConfigStatus() === "READY"
      ? false
      : isOAuthMockAllowed();
  } catch {
    return !isProductionOAuthProvider(providerKey) || isOAuthMockAllowed();
  }
}
