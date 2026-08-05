import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260805120000_stage_1_campaigns_core",
  "migration.sql",
);

describe("stage 1 campaigns migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("renames legacy content campaign members table", () => {
    expect(sql).toContain('RENAME TO "ContentCampaignMember"');
  });

  it("creates canonical Campaign table with tenant indexes", () => {
    expect(sql).toContain('CREATE TABLE "Campaign"');
    expect(sql).toContain("Campaign_organisationId_brandId_status_idx");
    expect(sql).toContain("Campaign_organisationId_archivedAt_idx");
  });

  it("creates related channel, kpi, member and activity tables", () => {
    expect(sql).toContain('CREATE TABLE "CampaignChannel"');
    expect(sql).toContain('CREATE TABLE "CampaignKpi"');
    expect(sql).toContain('CREATE TABLE "CampaignMember"');
    expect(sql).toContain('CREATE TABLE "CampaignActivity"');
  });
});

describe("campaign API route tree", () => {
  const routes = [
    "src/app/api/campaigns/route.ts",
    "src/app/api/campaigns/[campaignId]/route.ts",
    "src/app/api/campaigns/[campaignId]/transition/route.ts",
    "src/app/api/campaigns/[campaignId]/archive/route.ts",
    "src/app/api/campaigns/[campaignId]/restore/route.ts",
    "src/app/api/campaigns/[campaignId]/channels/route.ts",
    "src/app/api/campaigns/[campaignId]/channels/[channelId]/route.ts",
    "src/app/api/campaigns/[campaignId]/kpis/route.ts",
    "src/app/api/campaigns/[campaignId]/kpis/[kpiId]/route.ts",
    "src/app/api/campaigns/[campaignId]/members/route.ts",
    "src/app/api/campaigns/[campaignId]/members/[memberId]/route.ts",
    "src/app/api/campaigns/[campaignId]/activity/route.ts",
  ];

  for (const route of routes) {
    it(`includes ${route}`, () => {
      expect(() => readFileSync(path.join(process.cwd(), route), "utf8")).not.toThrow();
    });
  }
});

describe("campaign UI routes", () => {
  const pages = [
    "src/app/(dashboard)/campaigns/page.tsx",
    "src/app/(dashboard)/campaigns/new/page.tsx",
    "src/app/(dashboard)/campaigns/[campaignId]/page.tsx",
    "src/components/campaigns/campaign-list-view.tsx",
    "src/components/campaigns/campaign-create-wizard.tsx",
    "src/components/campaigns/campaign-detail-view.tsx",
  ];

  for (const page of pages) {
    it(`includes ${page}`, () => {
      const content = readFileSync(path.join(process.cwd(), page), "utf8");
      expect(content.length).toBeGreaterThan(0);
    });
  }
});
