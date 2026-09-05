import { describe, expect, it } from "vitest";
import {
  assertSafeDatabaseOperation,
  classifyDatabaseTarget,
} from "@/lib/database/environment-guard";

describe("database environment guard", () => {
  it("classifies localhost as development/test targets", () => {
    const dev = classifyDatabaseTarget(
      "postgresql://postgres:postgres@localhost:5432/cresco_marketing?schema=public",
      "development",
    );
    expect(dev.environment).toBe("development");
    expect(dev.isLocalhost).toBe(true);
    expect(dev.isProductionLike).toBe(false);
    expect(dev.safeIdentifier).toContain("localhost");
  });

  it("blocks destructive operations against production-like targets", () => {
    expect(() =>
      assertSafeDatabaseOperation({
        operation: "db_push",
        databaseUrl: "postgresql://postgres:password@db.abc123.supabase.co:5432/postgres",
        nodeEnv: "development",
      }),
    ).toThrow(/Blocked db_push against production-like database target/);
  });

  it("allows read-only audit against production-like targets", () => {
    const target = assertSafeDatabaseOperation({
      operation: "audit",
      databaseUrl: "postgresql://postgres:password@db.abc123.supabase.co:5432/postgres",
    });
    expect(target.isProductionLike).toBe(true);
  });

  it("blocks test runs from targeting production", () => {
    expect(() =>
      assertSafeDatabaseOperation({
        operation: "truncate",
        databaseUrl: "postgresql://postgres:password@db.abc123.supabase.co:5432/postgres",
        nodeEnv: "test",
      }),
    ).toThrow(/test environment must not target production database/);
  });

  it("allows controlled production migrate deploy when explicitly flagged", () => {
    const target = assertSafeDatabaseOperation({
      operation: "migrate_deploy",
      databaseUrl: "postgresql://postgres:password@db.abc123.supabase.co:5432/postgres",
      allowProduction: true,
      explicitAllowFlag: "confirm",
    });
    expect(target.environment).toBe("production");
  });
});
