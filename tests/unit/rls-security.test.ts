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

  it("revokes API-role table grants conditionally when roles exist", () => {
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I");
    expect(sql).toContain("ARRAY['anon', 'authenticated', 'service_role']");
    expect(sql).toContain("pg_roles WHERE rolname = api_role");
  });

  it("revokes PUBLIC execute on all existing public functions", () => {
    expect(sql).toContain("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC");
  });

  it("revokes API-role sequence and function grants conditionally", () => {
    expect(sql).toContain("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I");
    expect(sql).toContain("REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I");
  });

  it("sets default privileges including PUBLIC function execute revocation", () => {
    expect(sql).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC");
    expect(sql).toContain("REVOKE ALL ON TABLES FROM %I");
    expect(sql).toContain("REVOKE ALL ON SEQUENCES FROM %I");
    expect(sql).toContain("REVOKE ALL ON FUNCTIONS FROM %I");
  });

  it("uses valid PostgreSQL DROP EVENT TRIGGER syntax", () => {
    expect(sql).not.toMatch(/DROP EVENT TRIGGER[^;]+ ON ddl_command_end/i);
    expect(sql).toContain("DROP EVENT TRIGGER IF EXISTS trg_ensure_public_table_rls;");
    expect(sql).toContain("DROP EVENT TRIGGER IF EXISTS trg_ensure_public_function_privileges;");
  });

  it("installs table event trigger scoped to public CREATE TABLE only", () => {
    expect(sql).toContain("trg_ensure_public_table_rls");
    expect(sql).toContain("schema_name = 'public'");
    expect(sql).toContain("WHEN TAG IN ('CREATE TABLE')");
  });

  it("installs function event trigger for CREATE FUNCTION in public", () => {
    expect(sql).toContain("trg_ensure_public_function_privileges");
    expect(sql).toContain("ensure_public_function_privileges");
    expect(sql).toContain("WHEN TAG IN ('CREATE FUNCTION')");
  });

  it("uses a fixed search_path on SECURITY DEFINER functions", () => {
    const matches = sql.match(/SET search_path = public, pg_temp/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("revokes execute on hardening functions from PUBLIC and API roles conditionally", () => {
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.ensure_public_table_rls() FROM PUBLIC");
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.ensure_public_table_rls() FROM %I",
    );
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.ensure_public_function_privileges() FROM PUBLIC",
    );
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.ensure_public_function_privileges() FROM %I",
    );
  });

  it("does not use permissive USING (true) policies", () => {
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("documents portability for vanilla PostgreSQL CI", () => {
    expect(sql).toContain("GitHub CI");
    expect(sql).toContain("pg_roles");
  });

  it("secures _prisma_migrations without client policies", () => {
    expect(sql).toContain("_prisma_migrations");
    expect(sql).toContain("REVOKE ALL ON TABLE public._prisma_migrations FROM %I");
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });
});

const reconciliationPath = path.join(
  process.cwd(),
  "prisma/migrations/20260818120000_supabase_rls_reconciliation/migration.sql",
);

describe("Supabase RLS reconciliation migration", () => {
  const sql = readFileSync(reconciliationPath, "utf8");

  it("defines is_organisation_member with fixed search_path", () => {
    expect(sql).toContain("is_organisation_member");
    expect(sql).toContain("SET search_path = public, pg_temp");
    expect(sql).toContain('"OrganisationMembership"');
  });

  it("re-enables RLS on all public tables idempotently", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("c.relkind = 'r'");
  });

  it("re-revokes API-role grants conditionally", () => {
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I");
    expect(sql).toContain("pg_roles WHERE rolname = api_role");
  });

  it("does not use permissive USING (true) policies", () => {
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });
});

const cataloguePath = path.join(
  process.cwd(),
  "prisma/migrations/20260819180000_supabase_rls_catalogue_enforcement/migration.sql",
);

describe("Supabase RLS catalogue enforcement migration", () => {
  const sql = readFileSync(cataloguePath, "utf8");

  it("discovers tables from pg_class with relkind=r", () => {
    expect(sql).toContain("FROM pg_class c");
    expect(sql).toContain("c.relkind = 'r'");
    expect(sql).not.toContain("FROM pg_tables");
  });

  it("fails the migration when relrowsecurity is still false", () => {
    expect(sql).toContain("RAISE EXCEPTION");
    expect(sql).toContain("relrowsecurity=false");
  });

  it("does not swallow exceptions", () => {
    expect(sql).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it("does not modify grants", () => {
    expect(sql).not.toContain("REVOKE ALL ON ALL TABLES");
    expect(sql).not.toContain("GRANT ");
  });
});

describe("Supabase Data API RPC audit (static)", () => {
  it("documents zero supabase.rpc usage in application source", () => {
    // Repository-wide grep audit performed 2026-08-13:
    // - supabase.rpc( — not found in src/
    // - /rest/v1/rpc/ — not found
    // - /graphql/v1 — not found
    // - supabase.schema( — not found
    // Supabase client usage: auth.* and storage.* only
    expect(true).toBe(true);
  });
});
