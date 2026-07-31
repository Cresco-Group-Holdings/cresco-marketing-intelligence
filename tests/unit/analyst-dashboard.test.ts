import { describe, expect, it } from "vitest";
import { detectAnomalies } from "@/lib/analyst/anomaly-detection";
import { planQueries, validateQuery } from "@/lib/analyst/query-planner";
import { buildDeterministicAnalystOutput } from "@/lib/analyst/deterministic-output";
import { buildEvidencePackage } from "@/lib/analyst/evidence-package";
import { availableMetric, compareMetrics, unavailableMetric } from "@/lib/executive/metric-value";
import { validateAnalystOutput, buildAnalystAllowedContext } from "@/lib/analyst/ai-validation";

describe("analyst query planner", () => {
  it("plans bounded queries from question patterns", () => {
    const queries = planQueries("Which channels are growing?", 28);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every(validateQuery)).toBe(true);
  });

  it("rejects unbounded date ranges", () => {
    expect(validateQuery({ operation: "SUM", metric: "visitors", dateRangeDays: 999 })).toBe(false);
  });
});

describe("analyst anomaly detection", () => {
  it("detects significant percentage changes", () => {
    const anomalies = detectAnomalies({
      visitors: compareMetrics(availableMetric(150), availableMetric(100)),
    });
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]?.direction).toBe("UP");
  });

  it("ignores small samples", () => {
    const anomalies = detectAnomalies(
      { leads: compareMetrics(availableMetric(5), availableMetric(2)) },
      { minVolume: 10 },
    );
    expect(anomalies.length).toBe(0);
  });
});

describe("analyst evidence package", () => {
  it("marks unavailable metrics explicitly", () => {
    const evidence = buildEvidencePackage({
      overview: {
        kpis: { ltv: compareMetrics(unavailableMetric("No methodology"), unavailableMetric("No methodology")) },
        period: { from: "2026-01-01", to: "2026-01-31", comparisonFrom: "2025-12-01", comparisonTo: "2025-12-31", comparisonType: "PREVIOUS_PERIOD" },
        reportingCurrency: "USD",
        disclaimer: "test",
        formulaDefinitions: { ltv: "Requires methodology" },
        extensionPoints: { emailPerformance: "extension" },
      },
      warnings: [],
      anomalies: [],
    });
    expect(evidence.unavailableData.length).toBeGreaterThan(0);
  });
});

describe("analyst deterministic output", () => {
  it("produces structured output without AI", () => {
    const evidence = buildEvidencePackage({
      overview: {
        kpis: {
          revenue: compareMetrics(availableMetric(1000), availableMetric(800)),
        },
        period: { from: "2026-01-01", to: "2026-01-31", comparisonFrom: "2025-12-01", comparisonTo: "2025-12-31", comparisonType: "PREVIOUS_PERIOD" },
        reportingCurrency: "USD",
        disclaimer: "test",
        formulaDefinitions: { revenue: "Net revenue" },
        extensionPoints: { emailPerformance: "extension" },
      },
      warnings: [],
      anomalies: [],
    });
    const output = buildDeterministicAnalystOutput(evidence);
    expect(output.summary).toBeTruthy();
    expect(output.keyFindings.length).toBeGreaterThan(0);
    expect(output.evidenceReferences.length).toBeGreaterThan(0);
  });
});

describe("analyst AI validation", () => {
  it("rejects invented statistics", () => {
    const evidence = buildEvidencePackage({
      overview: {
        kpis: { revenue: compareMetrics(availableMetric(100), availableMetric(80)) },
        period: { from: "2026-01-01", to: "2026-01-31", comparisonFrom: "2025-12-01", comparisonTo: "2025-12-31", comparisonType: "PREVIOUS_PERIOD" },
        reportingCurrency: "USD",
        disclaimer: "test",
        formulaDefinitions: { revenue: "Net revenue" },
        extensionPoints: { emailPerformance: "extension" },
      },
      warnings: [],
      anomalies: [],
    });
    const context = buildAnalystAllowedContext(evidence);
    expect(() =>
      validateAnalystOutput(
        {
          summary: "Revenue hit 99999 which is great",
          keyFindings: [{ statement: "Big number", claimType: "MEASURED_FACT", evidenceKeys: ["revenue"], confidence: "HIGH" }],
          evidenceReferences: [{ evidenceKey: "revenue", claimType: "MEASURED_FACT" }],
          possibleExplanations: [],
          recommendedActions: [],
          measurementPlan: "Monitor",
          limitations: [],
          unavailableData: [],
        },
        context,
      ),
    ).toThrow();
  });
});
