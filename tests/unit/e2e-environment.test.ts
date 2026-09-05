import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertE2eHarnessNotEnabledInProduction,
  isE2eHarnessEnabled,
} from "@/lib/e2e/environment";
import { resolveHarnessAuthUserIdFromRequest } from "@/lib/e2e/test-auth";
import {
  assertTestAuthNotEnabledInProduction,
  isTestAuthBypassEnabled,
} from "@/lib/security/production-guards";

describe("E2E harness environment contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires explicit CRESCO_E2E_HARNESS outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_TEST_AUTH", "true");
    vi.stubEnv("TEST_AUTH_USER_ID", "user-1");
    expect(isE2eHarnessEnabled()).toBe(false);
    expect(isTestAuthBypassEnabled()).toBe(false);

    vi.stubEnv("CRESCO_E2E_HARNESS", "true");
    expect(isE2eHarnessEnabled()).toBe(true);
    expect(isTestAuthBypassEnabled()).toBe(true);
  });

  it("rejects harness and test auth in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRESCO_E2E_HARNESS", "true");
    vi.stubEnv("ALLOW_TEST_AUTH", "true");
    vi.stubEnv("TEST_AUTH_USER_ID", "user-1");

    expect(isE2eHarnessEnabled()).toBe(false);
    expect(isTestAuthBypassEnabled()).toBe(false);
    expect(() => assertE2eHarnessNotEnabledInProduction()).toThrow(/CRESCO_E2E_HARNESS/);
    expect(() => assertTestAuthNotEnabledInProduction()).toThrow(/ALLOW_TEST_AUTH|CRESCO_E2E_HARNESS/);
  });

  it("ignores user-controlled auth header without harness flag", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_TEST_AUTH", "true");
    vi.stubEnv("TEST_AUTH_USER_ID", "canonical-user");

    const request = new Request("http://localhost/api/workspace", {
      headers: { "x-cresco-e2e-user-id": "attacker-user" },
    });

    expect(resolveHarnessAuthUserIdFromRequest(request)).toBeNull();
  });

  it("accepts harness auth header only when harness is enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRESCO_E2E_HARNESS", "true");
    vi.stubEnv("ALLOW_TEST_AUTH", "true");
    vi.stubEnv("TEST_AUTH_USER_ID", "canonical-user");

    const request = new Request("http://localhost/api/workspace", {
      headers: { "x-cresco-e2e-user-id": "fixture-owner" },
    });

    expect(resolveHarnessAuthUserIdFromRequest(request)).toBe("fixture-owner");
  });
});
