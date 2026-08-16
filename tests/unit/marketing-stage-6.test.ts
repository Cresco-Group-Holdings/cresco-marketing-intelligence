import { describe, expect, it } from "vitest";
import { classifyIntent, toolsForIntent } from "@/lib/copilot/intent-router";
import { buildPageContext, resolveModuleFromRoute } from "@/lib/copilot/context";
import { computeCopilotConfidence } from "@/lib/copilot/confidence";
import { analyseBudgetReallocation, extractBudgetAmount } from "@/lib/copilot/diagnostics/budget";
import { diagnoseRoasChange } from "@/lib/copilot/diagnostics/roas";
import { isAllowedCopilotTool, validateToolArgs } from "@/lib/copilot/tools/registry";
import { rankMarketingPriorities } from "@/lib/copilot/priorities";
import { createEvidence } from "@/lib/copilot/format";

describe("copilot intent routing", () => {
  it("routes paid ROAS diagnosis on advertising context", () => {
    const context = buildPageContext({ route: "/advertising" });
    expect(classifyIntent("Why did ROAS decline this month?", context)).toBe("diagnosis");
    expect(toolsForIntent("diagnosis")).toContain("getPaidPerformance");
  });

  it("routes content questions on social reels context", () => {
    const context = buildPageContext({ route: "/social/reels" });
    expect(classifyIntent("Which should I reuse?", context)).toBe("content");
  });

  it("routes attribution questions on analytics content context", () => {
    const context = buildPageContext({ route: "/analytics/content", attributionModel: "LAST_TOUCH" });
    expect(classifyIntent("Which of these made money?", context)).toBe("attribution");
  });

  it("preserves module mapping", () => {
    expect(resolveModuleFromRoute("/advertising/campaigns")).toBe("advertising");
    expect(resolveModuleFromRoute("/analytics")).toBe("analytics");
  });
});

describe("copilot evidence and confidence", () => {
  it("requires evidence-backed facts in diagnostics", () => {
    const result = diagnoseRoasChange({
      currentRoas: 3.5,
      previousRoas: 4.3,
      currentSpend: 10000,
      previousSpend: 9000,
      currentRevenue: 35000,
      previousRevenue: 38700,
      providerBreakdown: [
        {
          provider: "META",
          currentSpend: 6000,
          previousSpend: 5000,
          currentRevenue: 18000,
          previousRevenue: 22000,
          currentRoas: 3,
          previousRoas: 4.4,
          currentCpa: 68,
          previousCpa: 54,
          currentCtr: 0.02,
          previousCtr: 0.025,
          conversions: 88,
        },
      ],
      periodLabel: "the last 30 days",
    });

    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts.every((fact) => fact.evidenceIds.length > 0)).toBe(true);
    expect(result.summary).toContain("declined");
  });

  it("lowers confidence when coverage is partial", () => {
    const confidence = computeCopilotConfidence({
      evidence: [createEvidence({ label: "Revenue", value: "Partial", coverage: 55 })],
      limitations: ["Attribution coverage below 70%."],
      coverage: 55,
      sampleSize: 8,
      minSampleSize: 20,
    });
    expect(["limited", "insufficient"]).toContain(confidence.level);
  });
});

describe("budget copilot safeguards", () => {
  it("extracts requested budget amount", () => {
    expect(extractBudgetAmount("Where should I move £5,000 of budget?")).toBe(5000);
  });

  it("does not recommend on insufficient sample", () => {
    const result = analyseBudgetReallocation({
      amount: 5000,
      channels: [
        {
          channel: "META",
          roas: 2.1,
          cpa: 80,
          spend: 1000,
          spendShare: 1,
          conversions: 5,
          trend: "declining",
          freshness: "fresh",
        },
      ],
      limitations: [],
    });
    expect(result.summary).toContain("sample sizes are too small");
  });

  it("stays advisory for strong channels", () => {
    const result = analyseBudgetReallocation({
      amount: 5000,
      channels: [
        {
          channel: "TIKTOK",
          roas: 5.2,
          cpa: 31,
          spend: 1200,
          spendShare: 0.12,
          conversions: 143,
          trend: "stable",
          freshness: "fresh",
        },
        {
          channel: "GOOGLE_ADS",
          roas: 4.6,
          cpa: 36,
          spend: 4000,
          spendShare: 0.4,
          conversions: 231,
          trend: "stable",
          freshness: "fresh",
        },
        {
          channel: "META",
          roas: 2.4,
          cpa: 68,
          spend: 8000,
          spendShare: 0.48,
          conversions: 117,
          trend: "declining",
          freshness: "fresh",
        },
      ],
      limitations: [],
    });
    expect(result.recommendations[0]?.statement).toContain("testing");
    expect(result.recommendations[0]?.statement).not.toContain("move the full");
  });
});

describe("copilot tool safety", () => {
  it("allowlists internal tools only", () => {
    expect(isAllowedCopilotTool("getPaidPerformance")).toBe(true);
    expect(isAllowedCopilotTool("dropDatabase")).toBe(false);
  });

  it("validates tenant scoped tool args", () => {
    expect(() =>
      validateToolArgs({
        toolName: "getPaidPerformance",
        brandId: "",
        organisationId: "org-1",
        from: new Date("2026-01-01"),
        to: new Date("2026-01-31"),
      }),
    ).toThrow();
  });
});

describe("priority engine", () => {
  it("ranks by impact and urgency not severity alone", () => {
    const priorities = rankMarketingPriorities([
      {
        id: "low",
        title: "Minor note",
        reason: "Small change",
        impact: "low",
        urgency: "low",
        confidence: "high",
        evidence: [],
      },
      {
        id: "high",
        title: "Review ROAS decline",
        reason: "ROAS dropped materially",
        impact: "high",
        urgency: "high",
        confidence: "moderate",
        evidence: [],
      },
    ]);
    expect(priorities[0]?.id).toBe("high");
  });
});

describe("attribution honesty fixtures", () => {
  it("keeps assisted separate from attributed in recommendations", () => {
    const result = diagnoseRoasChange({
      currentRoas: 3,
      previousRoas: 4,
      currentSpend: 5000,
      previousSpend: 5000,
      currentRevenue: 15000,
      previousRevenue: 20000,
      providerBreakdown: [],
      periodLabel: "the last 30 days",
    });
    expect(result.inferences.every((item) => !item.statement.toLowerCase().includes("caused"))).toBe(
      true,
    );
  });
});
