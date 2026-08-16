/**
 * Controls when mock publishing adapters are permitted.
 */

export function isPublishingMockAllowed(): boolean {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") return true;
  if (process.env.ALLOW_PUBLISHING_MOCK === "true") return true;
  return false;
}

export function isProductionPublishingRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export const PRODUCTION_PUBLISHING_PROVIDER_KEYS = ["meta", "meta-ads"] as const;

export function isProductionPublishingProvider(providerKey: string): boolean {
  return (PRODUCTION_PUBLISHING_PROVIDER_KEYS as readonly string[]).includes(providerKey);
}

export function assertProductionPublishingNotMock(providerKey: string, usingMock: boolean): void {
  if (
    usingMock &&
    isProductionPublishingRuntime() &&
    process.env.ALLOW_PUBLISHING_MOCK !== "true" &&
    isProductionPublishingProvider(providerKey)
  ) {
    throw new Error(
      `Production publishing for provider "${providerKey}" cannot use mock adapters.`,
    );
  }
}
