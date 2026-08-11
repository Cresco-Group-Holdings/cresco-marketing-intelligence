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

  it("revokes anon and authenticated table grants", () => {
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated");
  });

  it("sets default privileges for future postgres-created objects", () => {
    expect(sql).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public");
  });

  it("installs an event trigger for new public tables", () => {
    expect(sql).toContain("trg_ensure_public_table_rls");
    expect(sql).toContain("ensure_public_table_rls");
  });

  it("does not use permissive USING (true) policies", () => {
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("secures _prisma_migrations without client policies", () => {
    expect(sql).toContain("_prisma_migrations");
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });
});
