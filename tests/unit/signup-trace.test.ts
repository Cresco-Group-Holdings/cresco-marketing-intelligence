import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  logSignupCatch,
  logSignupRuntimeEnv,
  logSignupTrace,
} from "@/lib/auth/signup-trace";

describe("signup trace", () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://tests-project.supabase.co";
    process.env.DATABASE_URL = "postgresql://postgres.pooler.supabase.com:6543/postgres";
    process.env.DIRECT_URL = "postgresql://postgres.supabase.co:5432/postgres";
    process.env.APP_URL = "https://cresco-marketing-intelligence.vercel.app";
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("logs runtime env metadata without secrets", () => {
    logSignupRuntimeEnv("req-1");

    expect(console.error).toHaveBeenCalled();
    const payload = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]));
    expect(payload.step).toBe("RUNTIME_ENV");
    expect(payload.DATABASE_URL?.host).toBe("postgres.pooler.supabase.com");
    expect(JSON.stringify(payload)).not.toMatch(/password/i);
  });

  it("logs full error details on catch", () => {
    const error = new Error("fetch failed");
    error.name = "AuthRetryableFetchError";
    logSignupCatch("supabase.auth.signUp", "req-2", error);

    const payload = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]));
    expect(payload.step).toBe("CATCH supabase.auth.signUp");
    expect(payload.errorName).toBe("AuthRetryableFetchError");
    expect(payload.errorMessage).toBe("fetch failed");
    expect(payload.errorStack).toContain("signup-trace.test.ts");
  });

  it("logs step enter markers", () => {
    logSignupTrace("ENTER signup route", "req-3");
    const payload = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]));
    expect(payload.channel).toBe("signup.trace");
    expect(payload.requestId).toBe("req-3");
  });
});
