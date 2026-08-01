import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAllowedOrigins, resolveAppUrl } from "@/lib/environment/app-url";
import { getServerEnv, resetEnvCacheForTests } from "@/lib/environment";

const baseEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  APP_URL: "http://localhost:3000",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("resolveAppUrl", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    Object.assign(process.env, baseEnv);
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
  });

  afterEach(() => {
    resetEnvCacheForTests();
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
  });

  it("returns APP_URL for local development", () => {
    expect(resolveAppUrl()).toBe("http://localhost:3000");
  });

  it("uses the Vercel deployment URL when APP_URL still points to localhost", () => {
    process.env.VERCEL_URL = "cresco-marketing-intelligence.vercel.app";
    expect(resolveAppUrl()).toBe("https://cresco-marketing-intelligence.vercel.app");
  });

  it("keeps a production APP_URL when already configured", () => {
    process.env.APP_URL = "https://app.cresco.test";
    process.env.VERCEL_URL = "preview-branch.vercel.app";
    resetEnvCacheForTests();
    expect(resolveAppUrl()).toBe("https://app.cresco.test");
    expect(getServerEnv().APP_URL).toBe("https://app.cresco.test");
  });
});

describe("resolveAllowedOrigins", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    Object.assign(process.env, baseEnv);
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
  });

  afterEach(() => {
    resetEnvCacheForTests();
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
  });

  it("includes both APP_URL and Vercel deployment origins", () => {
    process.env.VERCEL_URL = "cresco-marketing-intelligence.vercel.app";
    expect(resolveAllowedOrigins()).toEqual(
      expect.arrayContaining([
        "http://localhost:3000",
        "https://cresco-marketing-intelligence.vercel.app",
      ]),
    );
  });
});
