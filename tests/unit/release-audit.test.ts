import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RELEASE_DOCS = [
  "PRODUCTION_RELEASE_AUDIT.md",
  "RELEASE_BLOCKERS.md",
  "V1_SCOPE.md",
  "RELEASE_SCORE.md",
  "SECURITY_RELEASE_REVIEW.md",
  "DATA_MIGRATION_PLAN.md",
  "ROLLBACK_PLAN.md",
  "SMOKE_TEST_PLAN.md",
  "INCIDENT_RESPONSE_PLAN.md",
  "KNOWN_LIMITATIONS.md",
  "POST_LAUNCH_BACKLOG.md",
  "V1_RELEASE_NOTES.md",
] as const;

const DOCS_DIR = join(process.cwd(), "docs", "release");

describe("Stage 18 release documentation", () => {
  it("includes all required launch documents", () => {
    for (const doc of RELEASE_DOCS) {
      expect(existsSync(join(DOCS_DIR, doc)), `missing ${doc}`).toBe(true);
    }
  });

  it("records a launch decision in the production audit", () => {
    const audit = readFileSync(join(DOCS_DIR, "PRODUCTION_RELEASE_AUDIT.md"), "utf8");
    expect(audit).toMatch(/CONDITIONALLY READY|READY|NOT READY/);
  });

  it("freezes V1 scope with module classifications", () => {
    const scope = readFileSync(join(DOCS_DIR, "V1_SCOPE.md"), "utf8");
    expect(scope).toContain("FROZEN");
    expect(scope).toContain("Production Ready");
    expect(scope).toContain("Coming Soon");
    expect(scope).toContain("Beta");
  });

  it("scores release dimensions with evidence", () => {
    const score = readFileSync(join(DOCS_DIR, "RELEASE_SCORE.md"), "utf8");
    expect(score).toMatch(/Overall score.*\d+/);
    expect(score).toContain("Security");
    expect(score).toContain("Tenant isolation");
    expect(score).toContain("Evidence");
  });
});

describe("Stage 18 verification gates", () => {
  it("classifies production environment with empty-string env override fix", async () => {
    const { classifyProductionEnvironment } = await import("@/lib/environment/classification");
    const original = { ...process.env };

    try {
      Object.assign(process.env, {
        DATABASE_URL: "postgresql://postgres.pooler.supabase.com:6543/postgres",
        DIRECT_URL: "postgresql://postgres.supabase.co:5432/postgres",
        APP_URL: "https://cresco-marketing-intelligence.vercel.app",
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.production-config-key-value-here",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.service-role-production-key-value",
      });

      const result = classifyProductionEnvironment();
      expect(result.isProductionReady).toBe(true);
      expect(result.blockers).toEqual([]);
    } finally {
      process.env = original;
    }
  });
});
