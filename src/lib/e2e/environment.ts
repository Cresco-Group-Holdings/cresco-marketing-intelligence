/**
 * Canonical E2E harness environment contract.
 *
 * Test authentication and harness-only behaviors require an explicit harness flag
 * and must remain impossible in production.
 */

export const E2E_HARNESS_ENV = "CRESCO_E2E_HARNESS";
export const E2E_AUTH_USER_HEADER = "x-cresco-e2e-user-id";

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Explicit opt-in for the deterministic launch E2E harness. */
export function isE2eHarnessEnabled(): boolean {
  if (isProductionEnvironment()) {
    return false;
  }
  return process.env[E2E_HARNESS_ENV] === "true";
}

export function assertE2eHarnessNotEnabledInProduction(): void {
  if (isProductionEnvironment() && process.env[E2E_HARNESS_ENV] === "true") {
    throw new Error(
      `${E2E_HARNESS_ENV} cannot be enabled in production. Remove it from environment configuration.`,
    );
  }
}
