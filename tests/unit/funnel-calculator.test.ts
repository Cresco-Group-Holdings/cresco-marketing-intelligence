import { describe, expect, it } from "vitest";
import { calculateFunnel } from "@/lib/funnel/calculator";
import type { FunnelStepDefinition, FunnelSubjectEvent } from "@/lib/funnel/types";

const baseDate = new Date("2026-01-01T00:00:00Z");

function event(
  subjectKey: string,
  eventName: string,
  dayOffset: number,
  extras?: Partial<FunnelSubjectEvent>,
): FunnelSubjectEvent {
  return {
    subjectKey,
    occurredAt: new Date(baseDate.getTime() + dayOffset * 86_400_000),
    eventName,
    identityId: subjectKey,
    sessionId: `session-${subjectKey}`,
    ...extras,
  };
}

const steps: FunnelStepDefinition[] = [
  { id: "s1", stepOrder: 1, name: "Visitor", stepType: "PAGE", matchingRules: { eventName: "page_view" }, requirement: "REQUIRED" },
  { id: "s2", stepOrder: 2, name: "Signup", stepType: "EVENT", matchingRules: { eventName: "signup_completed" }, requirement: "REQUIRED" },
  { id: "s3", stepOrder: 3, name: "Purchase", stepType: "CONVERSION", matchingRules: { conversionKey: "purchase" }, requirement: "REQUIRED" },
];

describe("funnel calculations", () => {
  it("calculates ordered step completions", () => {
    const events = [
      event("u1", "page_view", 0),
      event("u1", "signup_completed", 1),
      event("u1", "purchase", 2),
      event("u2", "page_view", 0),
      event("u2", "signup_completed", 1),
      event("u3", "page_view", 0),
    ];

    const result = calculateFunnel({ steps, events, countingMethod: "USER" });
    expect(result.entrants).toBe(3);
    expect(result.totalConversions).toBe(1);
    expect(result.stepResults[1]?.completions).toBe(2);
    expect(result.stepResults[2]?.completions).toBe(1);
  });

  it("tracks step and cumulative conversion rates", () => {
    const events = [
      event("u1", "page_view", 0),
      event("u1", "signup_completed", 1),
      event("u2", "page_view", 0),
    ];
    const result = calculateFunnel({ steps, events, countingMethod: "USER" });
    expect(result.stepResults[1]?.stepConversion).toBe(50);
    expect(result.stepResults[1]?.cumulativeConversion).toBe(50);
  });

  it("calculates drop-off count and rate", () => {
    const events = [
      event("u1", "page_view", 0),
      event("u2", "page_view", 0),
      event("u3", "page_view", 0),
      event("u1", "signup_completed", 1),
    ];
    const result = calculateFunnel({ steps, events, countingMethod: "USER" });
    expect(result.stepResults[1]?.dropOffCount).toBe(2);
    expect(result.stepResults[1]?.dropOffRate).toBeCloseTo(66.6667, 2);
  });

  it("counts sessions separately from users", () => {
    const events = [
      event("s1", "page_view", 0, { identityId: "u1", sessionId: "s1" }),
      event("s2", "page_view", 1, { identityId: "u1", sessionId: "s2" }),
    ];
    const userResult = calculateFunnel({ steps, events, countingMethod: "USER" });
    const sessionResult = calculateFunnel({ steps, events, countingMethod: "SESSION" });
    expect(userResult.entrants).toBe(1);
    expect(sessionResult.entrants).toBe(2);
  });

  it("counts repeated events in EVENT mode", () => {
    const events = [
      event("e1", "page_view", 0),
      event("e1", "page_view", 1),
    ];
    const result = calculateFunnel({ steps, events, countingMethod: "EVENT" });
    expect(result.entrants).toBe(2);
  });
});

describe("optional steps", () => {
  const optionalSteps: FunnelStepDefinition[] = [
    { id: "s1", stepOrder: 1, name: "Visit", stepType: "PAGE", matchingRules: { eventName: "page_view" }, requirement: "REQUIRED" },
    { id: "s2", stepOrder: 2, name: "Optional tour", stepType: "EVENT", matchingRules: { eventName: "tour_viewed" }, requirement: "OPTIONAL" },
    { id: "s3", stepOrder: 3, name: "Signup", stepType: "EVENT", matchingRules: { eventName: "signup_completed" }, requirement: "REQUIRED" },
  ];

  it("allows skipping optional steps", () => {
    const events = [
      event("u1", "page_view", 0),
      event("u1", "signup_completed", 1),
    ];
    const result = calculateFunnel({ steps: optionalSteps, events, countingMethod: "USER" });
    expect(result.stepResults[2]?.completions).toBe(1);
  });
});

describe("time windows", () => {
  const timedSteps: FunnelStepDefinition[] = [
    { id: "s1", stepOrder: 1, name: "Visit", stepType: "PAGE", matchingRules: { eventName: "page_view" }, requirement: "REQUIRED" },
    {
      id: "s2",
      stepOrder: 2,
      name: "Signup",
      stepType: "EVENT",
      matchingRules: { eventName: "signup_completed" },
      requirement: "REQUIRED",
      maxTimeToNextStepMs: 2 * 86_400_000,
    },
  ];

  it("excludes transitions outside max time window", () => {
    const events = [
      event("u1", "page_view", 0),
      event("u1", "signup_completed", 5),
      event("u2", "page_view", 0),
      event("u2", "signup_completed", 1),
    ];
    const result = calculateFunnel({ steps: timedSteps, events, countingMethod: "USER" });
    expect(result.stepResults[1]?.completions).toBe(1);
  });

  it("computes median time between steps", () => {
    const wideTimedSteps: FunnelStepDefinition[] = [
      { id: "s1", stepOrder: 1, name: "Visit", stepType: "PAGE", matchingRules: { eventName: "page_view" }, requirement: "REQUIRED" },
      {
        id: "s2",
        stepOrder: 2,
        name: "Signup",
        stepType: "EVENT",
        matchingRules: { eventName: "signup_completed" },
        requirement: "REQUIRED",
        maxTimeToNextStepMs: 7 * 86_400_000,
      },
    ];
    const events = [
      event("u1", "page_view", 0),
      event("u1", "signup_completed", 2),
      event("u2", "page_view", 0),
      event("u2", "signup_completed", 4),
    ];
    const result = calculateFunnel({ steps: wideTimedSteps, events, countingMethod: "USER" });
    expect(result.stepResults[1]?.medianTimeToNextMs).toBe(3 * 86_400_000);
  });
});

describe("repeated events", () => {
  it("uses first matching event per step in order", () => {
    const events = [
      event("u1", "page_view", 0),
      event("u1", "page_view", 1),
      event("u1", "signup_completed", 2),
      event("u1", "signup_completed", 3),
      event("u1", "purchase", 4),
    ];
    const result = calculateFunnel({ steps, events, countingMethod: "USER" });
    expect(result.totalConversions).toBe(1);
  });
});
