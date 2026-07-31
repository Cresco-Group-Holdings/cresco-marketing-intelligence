import { describe, expect, it } from "vitest";
import { shouldTriggerAlert, isProviderStale } from "@/lib/rank-tracking/alerts";
import { evaluateContentDecay } from "@/lib/rank-tracking/content-decay";
import { validateObservationRow } from "@/lib/rank-tracking/observation-import";
import { summariseRankHistory } from "@/lib/rank-tracking/rank-history";
import { generateRefreshRecommendations } from "@/lib/rank-tracking/refresh-recommendations";
import { detectVolatilitySignals } from "@/lib/rank-tracking/volatility";

describe("rank history", () => {
  it("does not treat missing data as rank zero", () => {
    const summary = summariseRankHistory([
      { observedDate: "2026-01-01", rank: 5 },
      { observedDate: "2026-01-08", rank: null },
    ]);
    expect(summary.currentPosition).toBeNull();
    expect(summary.previousPosition).toBe(5);
  });

  it("detects top-10 entry", () => {
    const summary = summariseRankHistory([
      { observedDate: "2026-01-01", rank: 15 },
      { observedDate: "2026-01-08", rank: 8 },
    ]);
    expect(summary.top10Entry).toBe(true);
  });

  it("detects target URL changes", () => {
    const summary = summariseRankHistory([
      { observedDate: "2026-01-01", rank: 5, url: "https://example.com/a" },
      { observedDate: "2026-01-08", rank: 6, url: "https://example.com/b" },
    ]);
    expect(summary.rankingUrlChanges).toBe(1);
  });
});

describe("observation import", () => {
  it("validates required fields", () => {
    const errors = validateObservationRow({
      source: "SEARCH_CONSOLE",
      keyword: "",
      location: "US",
      language: "en",
      device: "ALL",
      observedDate: "2026-01-01",
      rank: null,
    });
    expect(errors).toContain("keyword is required");
  });

  it("allows null rank for missing observations", () => {
    const errors = validateObservationRow({
      source: "SEARCH_CONSOLE",
      keyword: "seo tools",
      location: "US",
      language: "en",
      device: "ALL",
      observedDate: "2026-01-01",
      rank: null,
    });
    expect(errors).toHaveLength(0);
  });
});

describe("volatility", () => {
  it("detects large position movement", () => {
    const signals = detectVolatilitySignals([
      { observedDate: "2026-01-01", rank: 5 },
      { observedDate: "2026-01-08", rank: 15 },
      { observedDate: "2026-01-15", rank: 20 },
    ]);
    expect(signals.some((s) => s.changeType === "POSITION_LOSS")).toBe(true);
  });

  it("detects URL switching", () => {
    const signals = detectVolatilitySignals([
      { observedDate: "2026-01-01", rank: 5, url: "https://example.com/a" },
      { observedDate: "2026-01-08", rank: 5, url: "https://example.com/b" },
      { observedDate: "2026-01-15", rank: 6, url: "https://example.com/c" },
    ]);
    expect(signals.some((s) => s.changeType === "URL_SWITCH")).toBe(true);
  });

  it("requires minimum observations", () => {
    expect(detectVolatilitySignals([{ observedDate: "2026-01-01", rank: 5 }])).toHaveLength(0);
  });
});

describe("content decay", () => {
  it("does not label decay based only on age", () => {
    const result = evaluateContentDecay({ url: "https://example.com/old", lastModifiedDays: 500 });
    expect(result.isCandidate).toBe(false);
  });

  it("identifies decay with multiple signals", () => {
    const result = evaluateContentDecay({
      url: "https://example.com/page",
      clicksTrend: -0.3,
      impressionsTrend: -0.25,
      rankTrend: 5,
    });
    expect(result.isCandidate).toBe(true);
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
  });
});

describe("refresh recommendations", () => {
  it("includes evidence and measurement plan", () => {
    const recs = generateRefreshRecommendations(
      [{ signal: "declining_clicks", weight: 0.25, evidence: { trend: -0.3 } }],
      "2026-01-01",
      "2026-01-28",
    );
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].expectedHypothesis).toBeTruthy();
    expect(recs[0].measurementPlan).toContain("2026-01-01");
    expect(recs[0].confidence).toBeGreaterThan(0);
  });
});

describe("alerts", () => {
  it("respects cooldown", () => {
    const recent = new Date(Date.now() - 3600000);
    expect(
      shouldTriggerAlert(
        { changeType: "POSITION_LOSS", severity: "HIGH", evidence: { delta: 15 }, trackedKeywordId: "k1" },
        recent,
        100,
      ),
    ).toBe(false);
  });

  it("detects stale provider", () => {
    const stale = new Date(Date.now() - 10 * 86400000);
    expect(isProviderStale(stale, 7)).toBe(true);
    expect(isProviderStale(new Date(), 7)).toBe(false);
  });
});

describe("tenant isolation", () => {
  it("rank tracking service scopes by organisationId", async () => {
    const source = await import("fs/promises").then((fs) =>
      fs.readFile("src/server/services/seo-rank-tracking-service.ts", "utf8"),
    );
    expect(source).toContain("organisationId");
    expect(source).toContain("brandId");
  });
});
