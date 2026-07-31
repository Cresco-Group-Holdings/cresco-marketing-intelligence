import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  AI_ASSISTANT_DISCLAIMER,
  DEFAULT_DECAY_HALF_LIFE_DAYS,
  MAX_POINTS_PER_RULE,
  QUALIFICATION_THRESHOLDS,
} from "@/lib/lead-scoring/constants";
import { applyDecay, applySignalDecay } from "@/lib/lead-scoring/decay";
import {
  generateScoreExplanation,
  proposeRuleImprovements,
  suggestFollowUp,
} from "@/lib/lead-scoring/ai-assistant";
import { mapScoreToQualificationStatus } from "@/lib/lead-scoring/qualification";
import { evaluateRule, evaluateRuleGroup } from "@/lib/lead-scoring/rules";
import { computeScores, type ScoringModel } from "@/lib/lead-scoring/scoring";
import {
  listProhibitedAttributes,
  validateModelSafety,
  validateRuleSafety,
} from "@/lib/lead-scoring/safety";
import { simulateModel } from "@/lib/lead-scoring/simulation";
import type { LeadSnapshot } from "@/lib/lead-scoring/signals";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const now = new Date("2026-07-30T12:00:00.000Z");
const thirtyDaysAgo = new Date("2026-06-30T12:00:00.000Z");

function completeSnapshot(overrides: Partial<LeadSnapshot> = {}): LeadSnapshot {
  return {
    leadId: "lead-1",
    status: "NEW",
    lifecycleStage: "LEAD",
    productInterest: "CRESCO_GRANTS",
    country: "GB",
    language: "en",
    consentMarketing: true,
    lastActivityAt: now.toISOString(),
    industry: "Technology",
    emailOpens: 5,
    pageViews: 10,
    demoRequested: true,
    tags: ["grant-interest"],
    ...overrides,
  };
}

function baseModel(overrides: Partial<ScoringModel> = {}): ScoringModel {
  return {
    id: "model-1",
    name: "Test model",
    ruleGroups: [
      {
        id: "fit-group",
        category: "FIT",
        logic: "OR",
        rules: [
          {
            id: "fit-industry",
            signal: "TARGET_INDUSTRY",
            operator: "eq",
            value: "Technology",
            points: 20,
            label: "Target industry",
          },
          {
            id: "fit-country",
            signal: "TARGET_COUNTRY",
            operator: "eq",
            value: "GB",
            points: 15,
            label: "Target country",
          },
        ],
        cap: 30,
      },
      {
        id: "engagement-group",
        category: "ENGAGEMENT",
        logic: "OR",
        rules: [
          {
            id: "eng-demo",
            signal: "DEMO_REQUESTED",
            operator: "exists",
            points: 25,
            label: "Demo requested",
          },
          {
            id: "eng-pageviews",
            signal: "PAGE_VIEW",
            operator: "gte",
            value: 5,
            points: 20,
            label: "Page views",
          },
        ],
      },
      {
        id: "negative-group",
        category: "NEGATIVE",
        logic: "OR",
        rules: [
          {
            id: "neg-unsub",
            signal: "EMAIL_UNSUBSCRIBED",
            operator: "eq",
            value: true,
            points: -20,
            label: "Unsubscribed",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("rule contributions and caps", () => {
  it("sums matched OR rules and applies group cap with proportional evidence scaling", () => {
    const snapshot = completeSnapshot();
    const group = baseModel().ruleGroups[0];
    const result = evaluateRuleGroup(group, snapshot);

    expect(result.rawPoints).toBe(35);
    expect(result.cappedPoints).toBe(30);
    expect(result.capApplied).toBe(true);

    const matchedEvidence = result.evidence.filter((e) => e.matched);
    const scaledTotal = matchedEvidence.reduce((sum, e) => sum + e.cappedPoints, 0);
    expect(scaledTotal).toBeCloseTo(30, 1);
  });

  it("applies category and composite caps in computeScores", () => {
    const model = baseModel({
      ruleGroups: [
        {
          id: "fit-heavy",
          category: "FIT",
          logic: "OR",
          rules: [
            { id: "r1", signal: "TARGET_INDUSTRY", operator: "eq", value: "Technology", points: 40 },
            { id: "r2", signal: "TARGET_COUNTRY", operator: "eq", value: "GB", points: 40 },
          ],
        },
        {
          id: "eng-heavy",
          category: "ENGAGEMENT",
          logic: "OR",
          rules: [
            { id: "r3", signal: "DEMO_REQUESTED", operator: "exists", points: 50 },
            { id: "r4", signal: "PAGE_VIEW", operator: "gte", value: 1, points: 50 },
          ],
        },
      ],
      categoryCaps: { FIT: 60, ENGAGEMENT: 60, NEGATIVE: -30 },
      scoreCaps: { FIT: 100, ENGAGEMENT: 100, NEGATIVE: -50, COMPOSITE: 100 },
    });

    const scores = computeScores(model, completeSnapshot(), now);

    expect(scores.fitScore).toBeLessThanOrEqual(60);
    expect(scores.engagementScore).toBeLessThanOrEqual(60);
    expect(scores.compositeScore).toBeLessThanOrEqual(100);
    expect(scores.capsApplied.length).toBeGreaterThan(0);
  });

  it("enforces MAX_POINTS_PER_RULE per rule evaluation", () => {
    const result = evaluateRule(
      {
        id: "big-rule",
        signal: "TARGET_INDUSTRY",
        operator: "eq",
        value: "Technology",
        points: 999,
      },
      completeSnapshot(),
    );

    expect(result.points).toBe(MAX_POINTS_PER_RULE);
  });
});

describe("decay", () => {
  it("applies linear decay from 1.0 toward minFactor over half-life", () => {
    const atStart = applyDecay(100, 0, { formula: "LINEAR", halfLifeDays: 30, minFactor: 0.2 });
    expect(atStart.decayFactor).toBe(1);
    expect(atStart.decayedPoints).toBe(100);

    const atHalfLife = applyDecay(100, DEFAULT_DECAY_HALF_LIFE_DAYS, {
      formula: "LINEAR",
      halfLifeDays: DEFAULT_DECAY_HALF_LIFE_DAYS,
      minFactor: 0.2,
    });
    expect(atHalfLife.decayFactor).toBeCloseTo(0.2, 2);
    expect(atHalfLife.decayedPoints).toBeCloseTo(20, 0);
  });

  it("applies exponential half-life decay", () => {
    const atHalfLife = applyDecay(100, 30, {
      formula: "EXPONENTIAL",
      halfLifeDays: 30,
      minFactor: 0,
    });
    expect(atHalfLife.decayFactor).toBeCloseTo(0.5, 2);
    expect(atHalfLife.decayedPoints).toBeCloseTo(50, 0);

    const atDouble = applyDecay(100, 60, {
      formula: "EXPONENTIAL",
      halfLifeDays: 30,
      minFactor: 0,
    });
    expect(atDouble.decayFactor).toBeCloseTo(0.25, 2);
  });

  it("reduces engagement scores when decay is enabled on aged signals", () => {
    const model = baseModel({
      decay: { enabled: true, formula: "EXPONENTIAL", halfLifeDays: 30, minFactor: 0 },
      ruleGroups: [
        {
          id: "eng-only",
          category: "ENGAGEMENT",
          logic: "OR",
          rules: [
            { id: "eng-demo", signal: "DEMO_REQUESTED", operator: "exists", points: 40 },
          ],
        },
      ],
    });

    const fresh = computeScores(
      model,
      {
        ...completeSnapshot(),
        signalTimestamps: { DEMO_REQUESTED: now },
      },
      now,
    );
    const aged = computeScores(
      model,
      {
        ...completeSnapshot(),
        signalTimestamps: { DEMO_REQUESTED: thirtyDaysAgo },
      },
      now,
    );

    expect(aged.engagementScore).toBeLessThan(fresh.engagementScore);
    expect(aged.engagementScore).toBeCloseTo(fresh.engagementScore * 0.5, 0);
  });

  it("does not decay non-decayable fit signals", () => {
    const decay = applySignalDecay(
      "TARGET_INDUSTRY",
      20,
      completeSnapshot({ signalTimestamps: { TARGET_INDUSTRY: thirtyDaysAgo } }),
      { formula: "EXPONENTIAL", halfLifeDays: 30 },
      now,
    );
    expect(decay.decayFactor).toBe(1);
    expect(decay.decayedPoints).toBe(20);
  });
});

describe("negative signals", () => {
  it("subtracts composite score for matched negative rules", () => {
    const model = baseModel();
    const baseline = computeScores(model, completeSnapshot(), now);
    const penalised = computeScores(
      model,
      completeSnapshot({ unsubscribed: true }),
      now,
    );

    expect(penalised.negativeScore).toBeLessThan(0);
    expect(penalised.compositeScore).toBeLessThan(baseline.compositeScore);
  });

  it("caps negative category at configured floor", () => {
    const model = baseModel({
      categoryCaps: { FIT: 60, ENGAGEMENT: 60, NEGATIVE: -15 },
      ruleGroups: [
        {
          id: "neg-heavy",
          category: "NEGATIVE",
          logic: "OR",
          rules: [
            { id: "n1", signal: "EMAIL_UNSUBSCRIBED", operator: "eq", value: true, points: -20 },
            { id: "n2", signal: "BOUNCED_EMAIL", operator: "eq", value: true, points: -20 },
          ],
        },
      ],
    });

    const scores = computeScores(
      model,
      completeSnapshot({ unsubscribed: true, bounced: true }),
      now,
    );
    expect(scores.negativeScore).toBeGreaterThanOrEqual(-15);
  });
});

describe("qualification thresholds", () => {
  it("returns SALES_REVIEW_REQUIRED when required fields are missing", () => {
    const model = baseModel({ ruleGroups: [] });
    const scores = computeScores(model, completeSnapshot({ country: undefined }), now);
    const qualification = mapScoreToQualificationStatus(scores, completeSnapshot({ country: undefined }));

    expect(qualification.status).toBe("SALES_REVIEW_REQUIRED");
    expect(qualification.missingFields).toContain("country");
  });

  it("maps composite score to qualification bands", () => {
    const model = baseModel({ ruleGroups: [] });

    for (const [status, threshold] of Object.entries(QUALIFICATION_THRESHOLDS)) {
      const midScore = (threshold.min + threshold.max) / 2;
      const scores = computeScores(model, completeSnapshot(), now);
      scores.compositeScore = midScore;
      const qualification = mapScoreToQualificationStatus(scores, completeSnapshot());
      expect(qualification.status).toBe(status);
    }
  });

  it("disqualifies suppressed leads regardless of score", () => {
    const model = baseModel();
    const scores = computeScores(model, completeSnapshot({ suppressed: true }), now);
    const qualification = mapScoreToQualificationStatus(scores, completeSnapshot({ suppressed: true }));

    expect(qualification.status).toBe("NOT_QUALIFIED");
    expect(qualification.reasons[0]).toContain("suppressed");
  });
});

describe("prohibited attributes", () => {
  it("lists protected demographic and sensitive attributes", () => {
    const prohibited = listProhibitedAttributes();
    expect(prohibited).toContain("race");
    expect(prohibited).toContain("gender");
    expect(prohibited).toContain("creditScore");
  });

  it("rejects rules referencing prohibited fields in safety validation", () => {
    const result = validateRuleSafety({
      id: "bad-rule",
      signal: "TARGET_INDUSTRY",
      field: "gender",
      operator: "eq",
      value: "female",
      points: 10,
    });
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes("prohibited"))).toBe(true);
  });

  it("does not award points when rule field is prohibited", () => {
    const result = evaluateRule(
      {
        id: "blocked",
        signal: "TARGET_INDUSTRY",
        field: "age",
        operator: "gte",
        value: 25,
        points: 30,
      },
      completeSnapshot({ industry: "Technology" }),
    );
    expect(result.matched).toBe(false);
    expect(result.points).toBe(0);
  });

  it("flags prohibited fields in model review checklist", () => {
    const result = validateModelSafety({
      id: "unsafe-model",
      name: "Unsafe",
      ruleGroups: [
        {
          id: "g1",
          category: "FIT",
          logic: "OR",
          rules: [
            {
              id: "r1",
              signal: "TARGET_INDUSTRY",
              field: "religion",
              operator: "eq",
              value: "any",
              points: 10,
            },
          ],
        },
      ],
    });
    expect(result.safe).toBe(false);
    expect(result.checklist.find((c) => c.id === "no_prohibited_attributes")?.passed).toBe(false);
  });
});

describe("simulation output", () => {
  it("returns distribution, status changes, and high-impact rules", () => {
    const model = baseModel();
    const leads = [
      {
        snapshot: completeSnapshot({ leadId: "lead-a" }),
        previousStatus: "LOW_PRIORITY" as const,
        previousCompositeScore: 0,
      },
      {
        snapshot: completeSnapshot({ leadId: "lead-b", unsubscribed: true }),
        previousStatus: "SALES_REVIEW_REQUIRED" as const,
        previousCompositeScore: 30,
      },
    ];

    const result = simulateModel(model, leads);

    expect(result.totalLeads).toBe(2);
    expect(result.scoreDistribution.length).toBe(4);
    expect(result.scoreDistribution.reduce((sum, b) => sum + b.count, 0)).toBe(2);
    expect(result.averageCompositeScore).toBeGreaterThan(0);
    expect(result.highImpactRules.length).toBeGreaterThan(0);
    expect(result.highImpactRules[0].matchCount).toBeGreaterThan(0);
    expect(result.statusChanges.length).toBeGreaterThan(0);
  });
});

describe("AI explanation grounding", () => {
  it("does not modify scores or qualification when generating explanations", () => {
    const model = baseModel();
    const snapshot = completeSnapshot();
    const scores = computeScores(model, snapshot, now);
    const scoresBefore = structuredClone(scores);
    const qualification = mapScoreToQualificationStatus(scores, snapshot);
    const qualificationBefore = structuredClone(qualification);

    const explanation = generateScoreExplanation(scores, qualification, snapshot);
    const followUp = suggestFollowUp(scores, qualification, snapshot);
    const improvements = proposeRuleImprovements(model, scores, snapshot);

    expect(explanation.grounded).toBe(true);
    expect(explanation.modifiesScore).toBe(false);
    expect(explanation.disclaimer).toBe(AI_ASSISTANT_DISCLAIMER);
    expect(explanation.evidence.compositeScore).toBe(scores.compositeScore);

    if (followUp) {
      expect(followUp.grounded).toBe(true);
      expect(followUp.autoApplyBlocked).toBe(true);
    }

    for (const item of improvements) {
      expect(item.grounded).toBe(true);
      expect(item.modifiesScore).toBe(false);
    }

    expect(scores).toEqual(scoresBefore);
    expect(qualification).toEqual(qualificationBefore);
  });
});

describe("permissions", () => {
  it("grants owners full lead scoring access", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["leadScoring.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["leadScoring.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["leadScoring.approve"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["leadScoring.override"])).toBe(true);
  });

  it("grants marketers create and simulate without approve", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["leadScoring.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["leadScoring.simulate"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["leadScoring.approve"])).toBe(false);
  });

  it("restricts viewers to read-only lead scoring", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["leadScoring.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["leadScoring.create"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["leadScoring.override"])).toBe(false);
  });

  it("allows analysts to read and simulate", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["leadScoring.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["leadScoring.simulate"])).toBe(true);
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["leadScoring.edit"])).toBe(false);
  });
});
