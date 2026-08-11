import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "prisma/migrations/20260811120000_supabase_rls_hardening/migration.sql",
);

describe("Supabase RLS hardening migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("enables RLS on existing public tables", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("revokes anon, authenticated, and service_role table grants", () => {
    expect(sql).toContain(
      "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role",
    );
  });

  it("revokes service_role sequence and function grants", () => {
    expect(sql).toContain(
      "REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role",
    );
    expect(sql).toContain(
      "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role",
    );
  });

  it("sets default privileges for future postgres-created objects", () => {
    expect(sql).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public");
    expect(sql).toContain("REVOKE ALL ON TABLES FROM anon, authenticated, service_role");
  });

  it("installs an event trigger scoped to public CREATE TABLE only", () => {
    expect(sql).toContain("trg_ensure_public_table_rls");
    expect(sql).toContain("schema_name = 'public'");
    expect(sql).toContain("WHEN TAG IN ('CREATE TABLE')");
  });

  it("uses a fixed search_path on the event trigger function", () => {
    expect(sql).toMatch(/SET search_path = public, pg_temp/);
  });

  it("revokes service_role on new tables in the event trigger", () => {
    expect(sql).toContain("REVOKE ALL ON TABLE %s FROM anon, authenticated, service_role");
  });

  it("does not use permissive USING (true) policies", () => {
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("documents that postgres is not a superuser", () => {
    expect(sql).toContain("NOT a PostgreSQL superuser");
    expect(sql).not.toMatch(/postgres\s+superuser/i);
  });

  it("secures _prisma_migrations without client policies", () => {
    expect(sql).toContain("_prisma_migrations");
    expect(sql).toContain("FROM anon, authenticated, service_role");
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });
});
