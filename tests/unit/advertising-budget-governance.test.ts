import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { evaluateBudgetAlerts } from "@/lib/advertising-budget-governance/alerts";
import { canRoleApprove, evaluateApprovalPolicy } from "@/lib/advertising-budget-governance/approval-policy";
import {
  assertNoAutonomousSpendIncrease,
  validateChangeRequest,
} from "@/lib/advertising-budget-governance/change-requests";
import { aggregateCrossProviderSpend, convertCurrency } from "@/lib/advertising-budget-governance/currency";
import {
  applyEmergencyControl,
  canMutateBudget,
  createInitialEmergencyState,
  validateRestoration,
} from "@/lib/advertising-budget-governance/emergency-controls";
import { calculatePacing, calculatePercentageChange } from "@/lib/advertising-budget-governance/pacing";
import { buildAiRecommendation, canAutoApplyRecommendation } from "@/lib/advertising-budget-governance/ai-recommendations";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("pacing formulas", () => {
  const periodStart = new Date("2026-07-01T00:00:00Z");
  const periodEnd = new Date("2026-07-31T00:00:00Z");
  const asOf = new Date("2026-07-16T00:00:00Z");

  it("calculates elapsed time and expected spend deterministically", () => {
    const result = calculatePacing({
      periodStart,
      periodEnd,
      totalBudget: 10000,
      actualSpend: 6000,
      asOf,
    });
    expect(result.elapsedTimePct).toBeCloseTo(50, 0);
    expect(result.expectedSpend).toBeCloseTo(5000, 0);
    expect(result.spendVariance).toBeCloseTo(1000, 0);
    expect(result.projectedSpend).toBeCloseTo(12000, 0);
    expect(result.overspendRisk).toBe(true);
  });

  it("calculates required daily pace from remaining budget", () => {
    const result = calculatePacing({
      periodStart,
      periodEnd,
      totalBudget: 10000,
      actualSpend: 4000,
      asOf,
    });
    expect(result.remainingBudget).toBe(6000);
    expect(result.requiredDailyPace).toBeGreaterThan(0);
  });

  it("calculates percentage change", () => {
    expect(calculatePercentageChange(1000, 1100)).toBe(10);
    expect(calculatePercentageChange(0, 500)).toBe(100);
  });
});

describe("mixed currency and missing FX", () => {
  const rates = [
    { fromCurrency: "EUR", toCurrency: "USD", rate: 1.1, rateDate: new Date("2026-07-01"), source: "ecb" },
  ];

  it("converts with rate metadata", () => {
    const result = convertCurrency({
      amount: 100,
      fromCurrency: "EUR",
      toCurrency: "USD",
      rates,
    });
    expect(result.convertedAmount).toBe(110);
    expect(result.fxRate).toBe(1.1);
    expect(result.fxRateSource).toBe("ecb");
    expect(result.fxRateMissing).toBe(false);
  });

  it("warns on missing FX rate", () => {
    const result = convertCurrency({
      amount: 100,
      fromCurrency: "GBP",
      toCurrency: "USD",
      rates,
    });
    expect(result.fxRateMissing).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("aggregates cross-provider totals with mixed currency", () => {
    const result = aggregateCrossProviderSpend({
      reportingCurrency: "USD",
      rates,
      observations: [
        { provider: "google", amount: 500, currency: "USD" },
        { provider: "meta", amount: 200, currency: "EUR" },
      ],
    });
    expect(result.total).toBe(720);
    expect(result.lineItems).toHaveLength(2);
  });
});

describe("overspend warnings", () => {
  it("triggers overspend risk alert", () => {
    const pacing = calculatePacing({
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
      totalBudget: 1000,
      actualSpend: 700,
      asOf: new Date("2026-07-10"),
    });
    const alerts = evaluateBudgetAlerts({ pacing, totalBudget: 1000 });
    expect(alerts.some((a) => a.alertType === "OVERSPEND_RISK")).toBe(true);
  });

  it("triggers budget exhausted alert", () => {
    const pacing = calculatePacing({
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
      totalBudget: 1000,
      actualSpend: 1000,
      asOf: new Date("2026-07-15"),
    });
    const alerts = evaluateBudgetAlerts({ pacing, totalBudget: 1000 });
    expect(alerts.some((a) => a.alertType === "BUDGET_EXHAUSTED")).toBe(true);
  });
});

describe("approval thresholds and hard limits", () => {
  const policy = {
    marketerCanRequest: true,
    adminApprovalThresholdPct: 10,
    ownerApprovalThresholdPct: 25,
    hardLimitPct: 50,
    clientApprovalRequired: false,
  };

  it("allows admin approval for small changes", () => {
    const result = evaluateApprovalPolicy({
      policy,
      requesterRole: OrganisationRole.MARKETER,
      percentageChange: 5,
      isIncrease: true,
    });
    expect(result.requiredApprover).toBe("ADMIN");
    expect(result.autoReject).toBe(false);
  });

  it("requires owner for large changes", () => {
    const result = evaluateApprovalPolicy({
      policy,
      requesterRole: OrganisationRole.MARKETER,
      percentageChange: 30,
      isIncrease: true,
    });
    expect(result.requiredApprover).toBe("OWNER");
  });

  it("auto-rejects above hard limit", () => {
    const result = evaluateApprovalPolicy({
      policy,
      requesterRole: OrganisationRole.MARKETER,
      percentageChange: 60,
      isIncrease: true,
    });
    expect(result.autoReject).toBe(true);
  });

  it("admin can approve within admin threshold", () => {
    expect(canRoleApprove(OrganisationRole.ADMIN, "ADMIN")).toBe(true);
    expect(canRoleApprove(OrganisationRole.MARKETER, "ADMIN")).toBe(false);
  });
});

describe("emergency pause and restoration", () => {
  it("blocks mutations when emergency pause active", () => {
    let state = createInitialEmergencyState();
    state = applyEmergencyControl(state, { controlType: "EMERGENCY_PAUSE", reason: "Overspend detected" });
    const check = canMutateBudget(state);
    expect(check.allowed).toBe(false);
    expect(check.blockers.some((b) => b.includes("Emergency pause"))).toBe(true);
  });

  it("requires restoration approval", () => {
    let state = createInitialEmergencyState();
    state = applyEmergencyControl(state, { controlType: "ORGANISATION_FREEZE", reason: "Audit" });
    expect(validateRestoration(state, false).allowed).toBe(false);
    expect(validateRestoration(state, true).allowed).toBe(true);
  });
});

describe("stale provider data and provider drift", () => {
  it("alerts on stale provider data", () => {
    const pacing = calculatePacing({
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
      totalBudget: 5000,
      actualSpend: 1000,
      asOf: new Date("2026-07-15"),
    });
    const alerts = evaluateBudgetAlerts({
      pacing,
      totalBudget: 5000,
      providerDataAgeHours: 72,
    });
    expect(alerts.some((a) => a.alertType === "PROVIDER_DATA_STALE")).toBe(true);
  });

  it("alerts on unexpected provider budget change", () => {
    const pacing = calculatePacing({
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
      totalBudget: 5000,
      actualSpend: 1000,
      asOf: new Date("2026-07-15"),
    });
    const alerts = evaluateBudgetAlerts({
      pacing,
      totalBudget: 5000,
      providerBudget: 8000,
      lastKnownProviderBudget: 5000,
    });
    expect(alerts.some((a) => a.alertType === "UNEXPECTED_PROVIDER_BUDGET_CHANGE")).toBe(true);
  });
});

describe("change requests and autonomous spend guard", () => {
  it("validates increase requests", () => {
    const result = validateChangeRequest({
      requestType: "INCREASE_BUDGET",
      reason: "Scale winning campaign",
      currentBudget: 1000,
      proposedBudget: 1200,
    });
    expect(result.valid).toBe(true);
    expect(result.isIncrease).toBe(true);
  });

  it("blocks autonomous spend increases", () => {
    expect(assertNoAutonomousSpendIncrease("INCREASE_BUDGET", false).allowed).toBe(false);
    expect(assertNoAutonomousSpendIncrease("INCREASE_BUDGET", true).allowed).toBe(true);
    expect(assertNoAutonomousSpendIncrease("DECREASE_BUDGET", false).allowed).toBe(true);
  });
});

describe("AI recommendations", () => {
  it("never auto-applies recommendations", () => {
    expect(canAutoApplyRecommendation()).toBe(false);
    const rec = buildAiRecommendation({
      recommendationType: "REDUCE_SPEND",
      evidence: "CPA above target",
      uncertainty: "Attribution lag possible",
      budgetImpact: "-10% daily spend",
      measurementPlan: "Monitor CPA for 7 days",
    });
    expect(rec.requiresHumanApproval).toBe(true);
    expect(rec.canAutoApply).toBe(false);
  });
});

describe("tenant isolation permissions", () => {
  it("grants budget read to viewer", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingBudgets.read"])).toBe(true);
  });

  it("restricts emergency controls to admin and owner", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["advertisingBudgets.emergency"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingBudgets.emergency"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingBudgets.approve"])).toBe(false);
  });
});
