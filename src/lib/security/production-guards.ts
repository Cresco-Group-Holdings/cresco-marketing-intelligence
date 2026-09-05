/**
 * Runtime production guards for launch-critical security controls.
 */

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

const FORBIDDEN_PRODUCTION_ENV_FLAGS = [
  "ALLOW_TEST_AUTH",
  "CRESCO_E2E_HARNESS",
] as const;

function isForbiddenProductionFlagEnabled(flag: string): boolean {
  const value = process.env[flag];
  return value === "true" || value === "1";
}

/** Throws if test-auth or E2E harness bypass is enabled in production. */
export function assertTestAuthNotEnabledInProduction(): void {
  if (!isProductionEnvironment()) {
    return;
  }

  for (const flag of FORBIDDEN_PRODUCTION_ENV_FLAGS) {
    if (isForbiddenProductionFlagEnabled(flag)) {
      throw new Error(
        `${flag} cannot be enabled in production. Remove it from environment configuration.`,
      );
    }
  }
}

/** Returns true when E2E harness mode is explicitly enabled (never in production). */
export function isE2EHarnessEnabled(): boolean {
  if (isProductionEnvironment()) {
    return false;
  }
  return isForbiddenProductionFlagEnabled("CRESCO_E2E_HARNESS");
}

/** Safe check for middleware — returns false in production even if env is set. */
export function isTestAuthBypassEnabled(): boolean {
  if (isProductionEnvironment()) {
    return false;
  }
  return process.env.ALLOW_TEST_AUTH === "true" && Boolean(process.env.TEST_AUTH_USER_ID);
}
