import { describe, expect, it } from "vitest";
import { AuthError } from "@supabase/supabase-js";
import {
  assertSignupAuthConfiguration,
  isAntiEnumerationSignupResponse,
  mapSignupAuthError,
} from "@/lib/auth/signup-errors";
import { resetEnvCacheForTests } from "@/lib/environment";

const TEST_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.anonkey-for-unit-tests";

describe("signup auth errors", () => {
  it("rejects localhost Supabase configuration", () => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = TEST_ANON_KEY;

    expect(() => assertSignupAuthConfiguration()).toThrow(/not configured/i);
  });

  it("maps invalid API key errors to configuration failures", () => {
    const error = new AuthError("Invalid API key", 401, "invalid_api_key");
    const mapped = mapSignupAuthError(error, "supabase_signup");
    expect(mapped.code).toBe("AUTH_CONFIGURATION_ERROR");
    expect(mapped.status).toBe(503);
  });

  it("detects anti-enumeration duplicate signup responses", () => {
    expect(
      isAntiEnumerationSignupResponse({
        identities: [],
      }),
    ).toBe(true);
    expect(
      isAntiEnumerationSignupResponse({
        identities: [{ provider: "email" }],
      }),
    ).toBe(false);
  });
});
