import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260805200000_stage_10_ai_agent_foundation",
  "migration.sql",
);

describe("stage 10 agent foundation migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates agent platform tables", () => {
    expect(sql).toContain('CREATE TABLE "AgentPlatformRun"');
    expect(sql).toContain('CREATE TABLE "AgentPlatformRunStep"');
    expect(sql).toContain('CREATE TABLE "AgentPlatformToolCall"');
    expect(sql).toContain('CREATE TABLE "AgentPlatformProposedAction"');
    expect(sql).toContain('CREATE TABLE "AgentPlatformApproval"');
    expect(sql).toContain('CREATE TABLE "AgentPlatformEvaluation"');
    expect(sql).toContain('CREATE TABLE "AgentPlatformQuota"');
  });

  it("adds AGENT_ORCHESTRATION purpose", () => {
    expect(sql).toContain("AGENT_ORCHESTRATION");
  });
});

describe("agent API route tree", () => {
  const routes = [
    "src/app/api/agents/definitions/route.ts",
    "src/app/api/agents/runs/route.ts",
    "src/app/api/agents/runs/[runId]/route.ts",
    "src/app/api/agents/approvals/[approvalId]/decide/route.ts",
  ];

  for (const route of routes) {
    it(`includes ${route}`, () => {
      expect(() => readFileSync(path.join(process.cwd(), route), "utf8")).not.toThrow();
    });
  }
});

describe("agent platform UI", () => {
  it("includes agents dashboard page", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(dashboard)/agents/page.tsx"),
      "utf8",
    );
    expect(page).toContain("AgentPlatformView");
  });
});

describe("initial agent definitions", () => {
  it("includes all six required agents in feature export", () => {
    const feature = readFileSync(
      path.join(process.cwd(), "src/features/agents/index.ts"),
      "utf8",
    );
    expect(feature).toContain("campaign_strategist");
    expect(feature).toContain("content_planner");
    expect(feature).toContain("marketing_analyst");
    expect(feature).toContain("brand_compliance_reviewer");
    expect(feature).toContain("lead_qualification_assistant");
    expect(feature).toContain("advertising_optimisation_advisor");
  });
});
