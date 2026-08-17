/**
 * Controls when mock OAuth adapters are permitted.
 * Production must never silently use mock tokens for real providers.
 */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

/** Explicit opt-in for mock OAuth in non-test environments (local development). */
export function isOAuthMockExplicitlyAllowed(): boolean {
  return process.env.ALLOW_OAUTH_MOCK === "true";
}

export function isOAuthMockAllowed(): boolean {
  if (isTestRuntime()) return true;
  if (isOAuthMockExplicitlyAllowed()) return true;
  return false;
}

export function isMockSocialAdapterAllowed(): boolean {
  if (isTestRuntime()) return true;
  if (process.env.ALLOW_MOCK_SOCIAL_ADAPTERS === "true") return true;
  return false;
}

export function assertProductionOAuthNotMock(providerKey: string, usingMock: boolean): void {
  if (usingMock && isProductionRuntime() && !isOAuthMockExplicitlyAllowed()) {
    throw new Error(
      `Production OAuth for provider "${providerKey}" cannot use mock adapters. Configure provider credentials.`,
    );
  }
}
