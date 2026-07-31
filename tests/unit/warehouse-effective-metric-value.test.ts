import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  buildCorrectionIndex,
  resolveEffectiveMetricValue,
} from "@/lib/warehouse/effective-metric-value";

describe("warehouse effective metric values", () => {
  const observation = { id: "obs-1", metricValue: new Prisma.Decimal(100) };

  it("returns the observation value when no correction exists", () => {
    const result = resolveEffectiveMetricValue(observation, []);
    expect(result.source).toBe("observation");
    expect(Number(result.value)).toBe(100);
  });

  it("uses the latest correction exactly once", () => {
    const corrections = [
      {
        id: "corr-1",
        marketingMetricObservationId: "obs-1",
        correctedValue: new Prisma.Decimal(80),
        appliedAt: new Date("2026-07-29T10:00:00Z"),
      },
      {
        id: "corr-2",
        marketingMetricObservationId: "obs-1",
        correctedValue: new Prisma.Decimal(90),
        appliedAt: new Date("2026-07-30T10:00:00Z"),
      },
    ];

    const result = resolveEffectiveMetricValue(observation, corrections);
    expect(result.source).toBe("correction");
    expect(result.correctionId).toBe("corr-2");
    expect(Number(result.value)).toBe(90);
  });

  it("builds a correction index for aggregate recomputation", () => {
    const index = buildCorrectionIndex([
      {
        id: "corr-1",
        marketingMetricObservationId: "obs-1",
        correctedValue: new Prisma.Decimal(55),
        appliedAt: new Date("2026-07-30T10:00:00Z"),
      },
    ]);

    expect(Number(index.get("obs-1")?.value)).toBe(55);
    expect(index.get("obs-2")).toBeUndefined();
  });
});
