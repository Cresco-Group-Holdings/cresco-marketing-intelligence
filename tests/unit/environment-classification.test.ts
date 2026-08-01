import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  classifyKey,
  classifyProductionEnvironment,
  classifyUrl,
} from "@/lib/environment/classification";
import { resetEnvCacheForTests } from "@/lib/environment";

const TEST_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.anonkey-for-unit-tests";
const TEST_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.service-role-for-unit-tests";

const baseEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/test",
  SUPABASE_SERVICE_ROLE_KEY: TEST_SERVICE_ROLE_KEY,
  APP_URL: "http://localhost:3000",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  NEXT_PUBLIC_SUPABASE_URL: "https://tests-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: TEST_ANON_KEY,
};

describe("production environment classification", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    Object.assign(process.env, baseEnv);
  });

  afterEach(() => {
    resetEnvCacheForTests();
  });

  it("flags localhost database URLs as not production ready", () => {
    const result = classifyProductionEnvironment();
    expect(result.isProductionReady).toBe(false);
    expect(result.blockers.some((blocker) => blocker.includes("DATABASE_URL"))).toBe(true);
  });

  it("accepts Supabase production URLs and non-local APP_URL", () => {
    Object.assign(process.env, {
      DATABASE_URL:
        "postgresql://postgres.pooler.supabase.com:6543/postgres?pgbouncer=true",
      DIRECT_URL: "postgresql://postgres.supabase.co:5432/postgres",
      APP_URL: "https://cresco-marketing-intelligence.vercel.app",
      NEXT_PUBLIC_SUPABASE_URL: "https://tests-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: TEST_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: TEST_SERVICE_ROLE_KEY,
    });

    const result = classifyProductionEnvironment();
    expect(result.blockers).toEqual([]);
    expect(result.isProductionReady).toBe(true);
  });

  it("classifies database URLs without exposing secrets", () => {
    const result = classifyUrl("postgresql://postgres.pooler.supabase.com:6543/postgres", {
      database: true,
    });
    expect(result.hostSuffix).toBe("supabase.com");
    expect(result.port).toBe("6543");
    expect(result.databaseName).toBe("postgres");
  });

  it("classifies placeholder keys", () => {
    const result = classifyKey("public-anon-key");
    expect(result.looksPlaceholder).toBe(true);
  });
});
