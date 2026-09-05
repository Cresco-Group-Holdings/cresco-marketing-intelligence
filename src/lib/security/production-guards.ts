/**
 * Runtime production guards for launch-critical security controls.
 */

import {
  assertE2eHarnessNotEnabledInProduction,
  isE2eHarnessEnabled,
  isProductionEnvironment,
} from "@/lib/e2e/environment";

export { isProductionEnvironment };

/** Throws if test-auth bypass or harness mode is enabled in production. */
export function assertTestAuthNotEnabledInProduction(): void {
  assertE2eHarnessNotEnabledInProduction();
  if (isProductionEnvironment() && process.env.ALLOW_TEST_AUTH === "true") {
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
  if (!isE2eHarnessEnabled()) {
    return false;
  }
  return process.env.ALLOW_TEST_AUTH === "true";
}
