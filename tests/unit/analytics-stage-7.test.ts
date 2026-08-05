import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260805160000_stage_7_analytics_core",
  "migration.sql",
);

describe("stage 7 analytics migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates canonical analytics tables", () => {
    expect(sql).toContain('CREATE TABLE "AnalyticsDataSource"');
    expect(sql).toContain('CREATE TABLE "AnalyticsMetricDefinition"');
    expect(sql).toContain('CREATE TABLE "AnalyticsDimensionDefinition"');
    expect(sql).toContain('CREATE TABLE "AnalyticsFact"');
    expect(sql).toContain('CREATE TABLE "AnalyticsImportBatch"');
    expect(sql).toContain('CREATE TABLE "AnalyticsAttributionModel"');
    expect(sql).toContain('CREATE TABLE "AnalyticsGoal"');
    expect(sql).toContain('CREATE TABLE "AnalyticsSnapshot"');
  });

  it("enforces deduplication uniqueness per organisation", () => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "AnalyticsFact_organisationId_dedupeFingerprint_key"',
    );
  });
});

describe("analytics API route tree", () => {
  const routes = [
    "src/app/api/analytics/facts/route.ts",
    "src/app/api/analytics/imports/route.ts",
    "src/app/api/analytics/snapshots/route.ts",
    "src/app/api/analytics/dashboard/executive/route.ts",
    "src/app/api/analytics/dashboard/campaigns/route.ts",
    "src/app/api/analytics/dashboard/channels/route.ts",
    "src/app/api/analytics/dashboard/kpi-progress/route.ts",
    "src/app/api/analytics/dashboard/budget-pacing/route.ts",
    "src/app/api/analytics/dashboard/freshness/route.ts",
    "src/app/api/analytics/dashboard/anomalies/route.ts",
  ];

  for (const route of routes) {
    it(`includes ${route}`, () => {
      expect(() => readFileSync(path.join(process.cwd(), route), "utf8")).not.toThrow();
    });
  }
});

describe("analytics performance UI", () => {
  it("includes performance core page", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(dashboard)/analytics/performance/page.tsx"),
      "utf8",
    );
    expect(page).toContain("AnalyticsPerformanceView");
  });
});
