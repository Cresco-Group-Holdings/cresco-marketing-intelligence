import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mapAttributionTouchpointToInput } from "@/lib/attribution/touchpoint-mapper";
import { diagnoseRoasChange } from "@/lib/copilot/diagnostics/roas";
import {
  computeAttributionFromJourneys,
  mapJourneyToAttributionInput,
} from "@/lib/unified-analytics/attribution";

describe("date range selector accessible labels", () => {
  it("uses Start date and End date labels on custom range inputs", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/marketing/date-range-selector.tsx"),
      "utf8",
    );

    expect(source).toContain('label="Start date"');
    expect(source).toContain('label="End date"');
  });
});

describe("social performance workspace cn utility", () => {
  it("imports canonical cn helper from @/lib/utils", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/social/performance-workspace.tsx"),
      "utf8",
    );

    expect(source).toContain('import { cn } from "@/lib/utils"');
    expect(source).not.toMatch(/function cn\(/);
  });
});

describe("ROAS null contract", () => {
  const baseInput = {
    currentSpend: 10000,
    previousSpend: 9000,
    currentRevenue: 35000,
    previousRevenue: 38700,
    periodLabel: "the last 30 days",
    providerBreakdown: [],
  };

  it("does not treat null currentRoas as zero", () => {
    const result = diagnoseRoasChange({
      ...baseInput,
      currentRoas: null,
      previousRoas: 4,
    });

    expect(result.summary).toContain("cannot diagnose ROAS");
    expect(result.facts.some((fact) => fact.statement.includes("0.00x"))).toBe(false);
    expect(result.recommendations.some((rec) => rec.statement.includes("below-average ROAS"))).toBe(
      false,
    );
  });

  it("still diagnoses zero ROAS as a calculable value", () => {
    const result = diagnoseRoasChange({
      ...baseInput,
      currentRoas: 0,
      previousRoas: 2,
      currentRevenue: 0,
      previousRevenue: 8000,
    });

    expect(result.summary).toContain("declined");
    expect(result.facts.some((fact) => fact.statement.includes("0.00x"))).toBe(true);
  });
});

describe("organic workspace brand resolution", () => {
  it("resolves the selected workspace brand deterministically", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/server/services/organic-social-workspace-service.ts"),
      "utf8",
    );

    expect(source).toContain("workspace.brands.find");
    expect(source).toContain("workspace.preference.currentBrandId");
    expect(source).not.toContain("organisation.brand");
    expect(source).not.toContain("brands[0]");
  });
});

describe("organic conversions source", () => {
  it("reads campaign conversions from paid ads dashboard service", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/server/services/organic-social-workspace-service.ts"),
      "utf8",
    );

    expect(source).toContain(".getCampaigns(");
    expect(source).toContain("campaign.conversions");
  });
});

describe("attribution touchpoint normalization", () => {
  it("maps null position to undefined", () => {
    const mapped = mapAttributionTouchpointToInput({
      id: "tp-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      channel: "META",
      campaign: null,
      contentKey: null,
      position: null,
      isExcluded: false,
    });

    expect(mapped.position).toBeUndefined();
  });

  it("preserves zero position", () => {
    const mapped = mapAttributionTouchpointToInput({
      id: "tp-2",
      occurredAt: "2026-01-02T00:00:00.000Z",
      channel: "GOOGLE_ADS",
      campaign: null,
      contentKey: null,
      position: 0,
      isExcluded: false,
    });

    expect(mapped.position).toBe(0);
  });

  it("preserves positive integer position", () => {
    const mapped = mapAttributionTouchpointToInput({
      id: "tp-3",
      occurredAt: "2026-01-03T00:00:00.000Z",
      channel: "INSTAGRAM",
      campaign: null,
      contentKey: null,
      position: 3,
      isExcluded: false,
    });

    expect(mapped.position).toBe(3);
  });

  it("normalizes persisted journeys before attribution computation", () => {
    const journey = mapJourneyToAttributionInput({
      journeyStart: "2026-01-01T00:00:00.000Z",
      journeyEnd: "2026-01-10T00:00:00.000Z",
      revenueValue: 1000,
      status: "COMPLETED",
      touchpoints: [
        {
          id: "tp-null",
          occurredAt: "2026-01-05T00:00:00.000Z",
          channel: "META",
          position: null,
          isExcluded: false,
        },
        {
          id: "tp-zero",
          occurredAt: "2026-01-06T00:00:00.000Z",
          channel: "GOOGLE_ADS",
          position: 0,
          isExcluded: false,
        },
      ],
    });

    expect(journey.touchpoints[0]?.position).toBeUndefined();
    expect(journey.touchpoints[1]?.position).toBe(0);

    const result = computeAttributionFromJourneys([journey], "LAST_TOUCH", 30);
    expect(result.attributedConversions).toBeGreaterThanOrEqual(0);
  });
});
