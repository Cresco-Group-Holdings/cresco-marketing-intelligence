import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getClientEnv,
  getIntegrationStatus,
  getServerEnv,
  resetEnvCacheForTests,
} from "@/lib/environment";

const baseEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  APP_URL: "http://localhost:3000",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("environment validation", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    Object.assign(process.env, baseEnv);
  });

  afterEach(() => {
    resetEnvCacheForTests();
  });

  it("parses required server environment values", () => {
    const env = getServerEnv();
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.ENCRYPTION_KEY.length).toBeGreaterThanOrEqual(32);
  });

  it("parses required client environment values", () => {
    const env = getClientEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toContain("supabase.co");
  });

  it("reports integration configuration status", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_CLIENT_SECRET;
    delete process.env.X_CLIENT_ID;
    delete process.env.X_CLIENT_SECRET;
    resetEnvCacheForTests();
    const status = getIntegrationStatus(getServerEnv());
    expect(status.openai.configured).toBe(false);
    expect(status.google.configured).toBe(false);
    expect(status.x.configured).toBe(false);
  });

  it("throws a clear error for missing required values", () => {
    delete process.env.DATABASE_URL;
    resetEnvCacheForTests();
    expect(() => getServerEnv()).toThrow(/DATABASE_URL/);
  });
});
