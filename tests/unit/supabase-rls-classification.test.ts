import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const inventoryPath = path.join(process.cwd(), "docs/SUPABASE_RLS_INVENTORY.json");
const reinforcementPath = path.join(
  process.cwd(),
  "prisma/migrations/20260818210000_supabase_rls_hardening_reinforcement/migration.sql",
);

describe("Supabase RLS security classification inventory", () => {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));

  it("classifies every public table with an explicit security class", () => {
    for (const model of inventory.models) {
      expect(["A", "B", "C", "D"]).toContain(model.securityClass);
      expect(model.securityClassLabel).toBeTruthy();
    }
  });

  it("uses backend-only classification for all application tables", () => {
    const nonBackend = inventory.models.filter(
      (model: { securityClass: string; dataApiExposure: boolean }) =>
        model.securityClass !== "A" && model.securityClass !== "D",
    );
    expect(nonBackend).toEqual([]);
  });

  it("marks _prisma_migrations as internal system table", () => {
    const migrationTable = inventory.models.find(
      (model: { table: string }) => model.table === "_prisma_migrations",
    );
    expect(migrationTable?.securityClass).toBe("D");
    expect(migrationTable?.dataApiExposure).toBe(false);
  });

  it("documents zero intentionally public-read tables", () => {
    expect(inventory.summaryBySecurityClass.C ?? 0).toBe(0);
  });

  it("documents zero authenticated Data API tables", () => {
    expect(inventory.summaryBySecurityClass.B ?? 0).toBe(0);
  });
});

describe("Supabase RLS reinforcement migration", () => {
  const sql = readFileSync(reinforcementPath, "utf8");

  it("revokes PUBLIC table and sequence grants", () => {
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC");
    expect(sql).toContain("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC");
  });

  it("re-applies RLS enablement idempotently", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("updates ensure_public_table_rls to revoke PUBLIC on new tables", () => {
    expect(sql).toContain("REVOKE ALL ON TABLE %s FROM PUBLIC");
  });

  it("does not create permissive policies", () => {
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });
});
