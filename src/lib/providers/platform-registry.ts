import type { CanonicalProviderCapability } from "@/lib/providers/capability-registry";
import { providerSupportsCapability } from "@/lib/providers/capability-registry";
import { PROVIDER_ERROR_CODES, ProviderGatewayError } from "@/lib/providers/errors";
import type { PlatformProviderAdapter } from "@/lib/providers/platform-adapter";
import { getProviderDefinition } from "@/lib/providers/registry";
import { createMockAdvertisingAdapter } from "@/server/providers/mock-advertising/mock-advertising-adapter";
import { createMockCrmAdapter } from "@/server/providers/mock-crm/mock-crm-adapter";

const adapterCache = new Map<string, PlatformProviderAdapter>();

function cacheKey(providerKey: string, apiVersion: string) {
  return `${providerKey}:${apiVersion}`;
}

export function resolvePlatformAdapter(input: {
  providerKey: string;
  apiVersion?: string;
  capability?: CanonicalProviderCapability;
}): PlatformProviderAdapter {
  const definition = getProviderDefinition(input.providerKey);
  if (!definition && !["mock-advertising", "mock-crm"].includes(input.providerKey)) {
    throw new ProviderGatewayError({
      code: PROVIDER_ERROR_CODES.PROVIDER_NOT_FOUND,
      safeMessage: "Provider is not registered.",
    });
  }

  const apiVersion = input.apiVersion ?? definition?.apiVersion ?? "1.0";
  if (input.capability && !providerSupportsCapability(input.providerKey, input.capability)) {
    throw new ProviderGatewayError({
      code: PROVIDER_ERROR_CODES.PROVIDER_CAPABILITY_UNSUPPORTED,
      safeMessage: `Capability ${input.capability} is not supported by ${input.providerKey}.`,
    });
  }

  const key = cacheKey(input.providerKey, apiVersion);
  const cached = adapterCache.get(key);
  if (cached) return cached;

  let adapter: PlatformProviderAdapter | null = null;
  if (input.providerKey === "mock-advertising") {
    adapter = createMockAdvertisingAdapter();
  } else if (input.providerKey === "mock-crm") {
    adapter = createMockCrmAdapter();
  }

  if (!adapter) {
    throw new ProviderGatewayError({
      code: PROVIDER_ERROR_CODES.PROVIDER_NOT_FOUND,
      safeMessage: "No adapter implementation is available for this provider.",
    });
  }

  if (adapter.apiVersion !== apiVersion && !apiVersion.endsWith("-test")) {
    throw new ProviderGatewayError({
      code: PROVIDER_ERROR_CODES.PROVIDER_VERSION_UNSUPPORTED,
      safeMessage: `API version ${apiVersion} is not supported.`,
    });
  }

  adapterCache.set(key, adapter);
  return adapter;
}

export function resetPlatformAdapterCacheForTests() {
  adapterCache.clear();
}
