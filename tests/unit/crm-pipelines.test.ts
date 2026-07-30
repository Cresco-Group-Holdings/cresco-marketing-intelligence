import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { computeForecast, computeWeightedValue } from "@/lib/crm-pipelines/forecasting";
import { computePipelineHealth, detectHealthSignals } from "@/lib/crm-pipelines/health";
import {
  validateMarkLost,
  validateMarkWon,
  validateStageTransition,
} from "@/lib/crm-pipelines/transitions";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const baseStage = { id: "s1", name: "Open", sortOrder: 0, category: "OPEN", probability: 10 };
const nextStage = { id: "s2", name: "Qualification", sortOrder: 1, category: "QUALIFICATION", probability: 20, requiredFields: ["expectedValue"] };
const opp = {
  id: "o1", name: "Deal", status: "OPEN", probability: 10, currentStageId: "s1",
  ownerUserId: "u1", companyId: "c1", stageEnteredAt: new Date(), lastActivityAt: new Date(),
};

describe("pipeline stage transitions", () => {
  it("rejects direct move to WON stage", () => {
    const result = validateStageTransition({
      opportunity: opp,
      fromStage: baseStage,
      toStage: { ...baseStage, id: "won", category: "WON", sortOrder: 5 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("markWon");
  });

  it("requires reason for backward movement", () => {
    const result = validateStageTransition({
      opportunity: opp,
      fromStage: nextStage,
      toStage: baseStage,
    });
    expect(result.valid).toBe(false);
  });

  it("requires required fields for target stage", () => {
    const result = validateStageTransition({
      opportunity: { ...opp, expectedValue: undefined },
      fromStage: baseStage,
      toStage: nextStage,
      reason: "Progressing",
    });
    expect(result.valid).toBe(false);
  });

  it("blocks AI-only won recommendation", () => {
    const result = validateStageTransition({
      opportunity: opp,
      fromStage: baseStage,
      toStage: { ...baseStage, category: "WON", sortOrder: 5 },
      aiRecommended: true,
    });
    expect(result.valid).toBe(false);
  });
});

describe("won and lost validation", () => {
  it("requires evidence for won", () => {
    expect(validateMarkWon("AUTHORISED_CONFIRMATION", "INV-123").valid).toBe(true);
    expect(validateMarkWon("INVALID", "ref").valid).toBe(false);
    expect(validateMarkWon("PAYMENT_COMPLETED", "").valid).toBe(false);
  });

  it("requires loss reason", () => {
    expect(validateMarkLost("reason-1").valid).toBe(true);
    expect(validateMarkLost(undefined).valid).toBe(false);
  });
});

describe("forecasting", () => {
  it("computes weighted value deterministically", () => {
    const opps = [
      { id: "1", status: "OPEN", probability: 50, expectedValue: 10000, currency: "GBP" },
      { id: "2", status: "OPEN", probability: 80, expectedValue: 5000, currency: "GBP" },
    ];
    expect(computeWeightedValue(opps)).toBe(9000);
  });

  it("includes disclaimer on weighted estimate", () => {
    const forecast = computeForecast([
      { id: "1", status: "OPEN", probability: 50, expectedValue: 10000, currency: "GBP" },
    ]);
    expect(forecast.disclaimer).toContain("estimate");
    expect(forecast.weightedValue).toBe(5000);
  });
});

describe("pipeline health", () => {
  it("detects stale opportunities", () => {
    const stale = new Date(Date.now() - 20 * 86_400_000);
    const signals = detectHealthSignals({
      id: "o1", name: "Stale deal", status: "OPEN", lastActivityAt: stale,
    });
    expect(signals.some((s) => s.type === "stale_opportunity")).toBe(true);
  });

  it("detects missing value and decision maker", () => {
    const signals = detectHealthSignals({ id: "o1", name: "Deal", status: "OPEN" });
    expect(signals.some((s) => s.type === "missing_value")).toBe(true);
    expect(signals.some((s) => s.type === "missing_decision_maker")).toBe(true);
  });

  it("aggregates health summary", () => {
    const { summary } = computePipelineHealth([
      { id: "o1", name: "A", status: "OPEN" },
      { id: "o2", name: "B", status: "OPEN" },
    ]);
    expect(summary.missing_value).toBe(2);
  });
});

describe("opportunity permissions", () => {
  it("grants marketers move and mark won", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["opportunities.move"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["opportunities.markWon"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["pipelines.manage"])).toBe(false);
  });

  it("grants admins pipeline management", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["pipelines.manage"])).toBe(true);
  });

  it("limits viewers to read and forecast", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["opportunities.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["opportunities.move"])).toBe(false);
  });
});
