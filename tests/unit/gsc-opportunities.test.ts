import { describe, expect, it } from "vitest";
import { generateSearchOpportunities } from "@/lib/gsc/opportunities";

describe("GSC deterministic opportunities", () => {
  it("flags high impressions with low CTR", () => {
    const opportunities = generateSearchOpportunities([
      { query: "brand awareness", clicks: 5, impressions: 1200, ctr: 0.004, position: 6 },
    ]);
    expect(opportunities.some((item) => item.rule === "high_impressions_low_ctr")).toBe(true);
  });

  it("flags positions near the first page", () => {
    const opportunities = generateSearchOpportunities([
      { query: "pricing page", clicks: 20, impressions: 300, ctr: 0.06, position: 11 },
    ]);
    expect(opportunities.some((item) => item.rule === "near_first_page")).toBe(true);
  });

  it("flags declining clicks", () => {
    const opportunities = generateSearchOpportunities([
      {
        query: "product demo",
        clicks: 30,
        impressions: 500,
        ctr: 0.06,
        position: 5,
        previousClicks: 60,
      },
    ]);
    expect(opportunities.some((item) => item.rule === "declining_clicks")).toBe(true);
  });

  it("flags queries without a strong destination page", () => {
    const opportunities = generateSearchOpportunities([
      { query: "how to integrate", clicks: 10, impressions: 400, ctr: 0.025, position: 8 },
    ]);
    expect(opportunities.some((item) => item.rule === "query_without_strong_page")).toBe(true);
  });
});
