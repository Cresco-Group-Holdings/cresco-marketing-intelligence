import { describe, expect, it } from "vitest";
import { diagnoseRoasChange, type RoasDiagnosticInput } from "@/lib/copilot/diagnostics/roas";

function baseInput(overrides: Partial<RoasDiagnosticInput> = {}): RoasDiagnosticInput {
  return {
    currentRoas: 4,
    previousRoas: 4,
    currentSpend: 10000,
    previousSpend: 10000,
    currentRevenue: 40000,
    previousRevenue: 40000,
    providerBreakdown: [],
    periodLabel: "the last 30 days",
    ...overrides,
  };
}

function providerRow(
  overrides: Partial<RoasDiagnosticInput["providerBreakdown"][number]> = {},
): RoasDiagnosticInput["providerBreakdown"][number] {
  return {
    provider: "META",
    currentSpend: 5000,
    previousSpend: 5000,
    currentRevenue: 20000,
    previousRevenue: 20000,
    currentRoas: 4,
    previousRoas: 4,
    currentCpa: null,
    previousCpa: null,
    currentCtr: null,
    previousCtr: null,
    conversions: 100,
    ...overrides,
  };
}

describe("diagnoseRoasChange nullability semantics", () => {
  it("diagnoses healthy ROAS when current and previous periods are stable", () => {
    const result = diagnoseRoasChange(baseInput());

    expect(result.summary).toContain("improved");
    expect(result.recommendations).toHaveLength(0);
    expect(result.facts.some((fact) => fact.statement.includes("ROAS"))).toBe(true);
  });

  it("treats currentRoas = 0 as a valid numeric value", () => {
    const result = diagnoseRoasChange(
      baseInput({
        currentRoas: 0,
        previousRoas: 2,
        currentRevenue: 0,
        previousRevenue: 20000,
      }),
    );

    expect(result.summary).toContain("declined");
    expect(result.facts.some((fact) => fact.statement.includes("0.00x"))).toBe(true);
    expect(result.summary).not.toContain("unavailable");
  });

  it("returns insufficient-data state when currentRoas is null", () => {
    const result = diagnoseRoasChange(
      baseInput({
        currentRoas: null,
        previousRoas: 4,
      }),
    );

    expect(result.summary).toContain("cannot diagnose");
    expect(result.facts[0]?.statement).toContain("cannot be calculated");
    expect(result.recommendations[0]?.statement).toContain("Connect paid ad accounts");
    expect(result.recommendations.every((item) => !item.statement.includes("below-average ROAS"))).toBe(
      true,
    );
  });

  it("returns insufficient-data state when previousRoas is null", () => {
    const result = diagnoseRoasChange(
      baseInput({
        currentRoas: 4,
        previousRoas: null,
      }),
    );

    expect(result.summary).toContain("cannot diagnose");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.statement).not.toContain("below-average ROAS");
  });

  it("recommends reviewing underperforming providers when ROAS is materially below blended", () => {
    const result = diagnoseRoasChange(
      baseInput({
        currentRoas: 4,
        previousRoas: 4,
        providerBreakdown: [
          providerRow({
            provider: "META",
            currentRoas: 2,
            previousRoas: 4,
            currentSpend: 6000,
            previousSpend: 5000,
          }),
          providerRow({
            provider: "GOOGLE_ADS",
            currentRoas: 5,
            previousRoas: 5,
            currentSpend: 4000,
            previousSpend: 5000,
          }),
        ],
      }),
    );

    expect(result.recommendations.some((item) => item.statement.includes("META"))).toBe(true);
    expect(result.recommendations.some((item) => item.statement.includes("below-average ROAS"))).toBe(
      true,
    );
  });

  it("does not recommend underperformance when provider ROAS is unavailable (null)", () => {
    const result = diagnoseRoasChange(
      baseInput({
        currentRoas: 4,
        previousRoas: 4,
        providerBreakdown: [
          providerRow({
            provider: "META",
            currentRoas: null,
            previousRoas: 4,
            currentSpend: 6000,
            previousSpend: 5000,
          }),
        ],
      }),
    );

    expect(result.recommendations.every((item) => !item.statement.includes("below-average ROAS"))).toBe(
      true,
    );
  });

  it("does not treat null blended ROAS as zero underperformance", () => {
    const result = diagnoseRoasChange(
      baseInput({
        currentRoas: null,
        previousRoas: null,
        providerBreakdown: [
          providerRow({
            provider: "META",
            currentRoas: 0,
            previousRoas: 0,
            currentSpend: 6000,
            previousSpend: 5000,
          }),
        ],
      }),
    );

    expect(result.summary).toContain("cannot diagnose");
    expect(result.recommendations.every((item) => !item.statement.includes("below-average ROAS"))).toBe(
      true,
    );
  });
});
