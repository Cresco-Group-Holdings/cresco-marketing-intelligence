/**
 * Runtime production guards for launch-critical security controls.
 */

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Throws if test-auth bypass is enabled in production. */
export function assertTestAuthNotEnabledInProduction(): void {
  if (
    isProductionEnvironment() &&
    process.env.ALLOW_TEST_AUTH === "true"
  ) {
    throw new Error(
      "ALLOW_TEST_AUTH cannot be enabled in production. Remove it from environment configuration.",
    );
  }
}

/** Safe check for middleware — returns false in production even if env is set. */
export function isTestAuthBypassEnabled(): boolean {
  if (isProductionEnvironment()) {
    return false;
  }
  return process.env.ALLOW_TEST_AUTH === "true" && Boolean(process.env.TEST_AUTH_USER_ID);
}
