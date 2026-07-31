import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { isApprovalValid } from "@/lib/marketing-automation/approval";
import { evaluateCondition } from "@/lib/marketing-automation/conditions";
import { computeDelayResumeAt } from "@/lib/marketing-automation/delays";
import { checkRepeatPolicy } from "@/lib/marketing-automation/enrollment";
import { shouldExitBeforeAction } from "@/lib/marketing-automation/exit-rules";
import { validateAutomationGraph, type AutomationGraph } from "@/lib/marketing-automation/graph-validation";
import {
  checkDuplicateEnrollment,
  detectCycles,
  validateGraphSafety,
} from "@/lib/marketing-automation/safety";
import { matchTrigger } from "@/lib/marketing-automation/triggers";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const baseSnapshot = {
  leadId: "lead-1",
  status: "QUALIFIED",
  lifecycleStage: "LEAD",
  pipelineStage: "DISCOVERY",
  productInterest: "CRESCO_GRANTS",
  country: "GB",
  language: "en",
  consentMarketing: true,
  sourceType: "FORM",
  campaign: "spring-2026",
  tags: ["grant-interest"],
};

function minimalGraph(overrides: Partial<AutomationGraph> = {}): AutomationGraph {
  return {
    nodes: [
      { id: "trigger", type: "TRIGGER", config: { triggerType: "LEAD_CREATED" } },
      { id: "email", type: "ACTION", config: { actionType: "SEND_EMAIL", requiresApproval: true } },
      { id: "end", type: "END" },
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", targetNodeId: "email" },
      { id: "e2", sourceNodeId: "email", targetNodeId: "end" },
    ],
    exitRules: [{ type: "CONSENT_WITHDRAWN" }, { type: "LEAD_SUPPRESSED" }],
    ...overrides,
  };
}

describe("trigger matching", () => {
  it("matches lead created with source filter", () => {
    const matched = matchTrigger(
      { triggerType: "LEAD_CREATED", sourceTypes: ["FORM"] },
      { type: "LEAD_CREATED", occurredAt: new Date(), payload: { sourceType: "FORM" } },
    );
    expect(matched).toBe(true);
  });

  it("rejects mismatched trigger type", () => {
    const matched = matchTrigger(
      { triggerType: "FORM_SUBMITTED", formId: "form-1" },
      { type: "LEAD_CREATED", occurredAt: new Date(), payload: {} },
    );
    expect(matched).toBe(false);
  });

  it("matches form submitted with formId", () => {
    const matched = matchTrigger(
      { triggerType: "FORM_SUBMITTED", formId: "form-1" },
      { type: "FORM_SUBMITTED", occurredAt: new Date(), payload: { formId: "form-1" } },
    );
    expect(matched).toBe(true);
  });

  it("matches status change with from/to filters", () => {
    const matched = matchTrigger(
      { triggerType: "LEAD_STATUS_CHANGED", fromStatus: "NEW", toStatus: "QUALIFIED" },
      {
        type: "LEAD_STATUS_CHANGED",
        occurredAt: new Date(),
        payload: { fromStatus: "NEW", toStatus: "QUALIFIED" },
      },
    );
    expect(matched).toBe(true);
  });
});

describe("condition evaluation", () => {
  it("evaluates approved fields without arbitrary SQL", () => {
    expect(
      evaluateCondition({ field: "LEAD_STATUS", operator: "eq", value: "QUALIFIED" }, baseSnapshot),
    ).toBe(true);
    expect(
      evaluateCondition({ field: "TAG", operator: "contains", value: "grant-interest" }, baseSnapshot),
    ).toBe(true);
  });

  it("rejects unapproved fields", () => {
    expect(
      evaluateCondition({ field: "DROP TABLE leads", operator: "eq", value: "1" }, baseSnapshot),
    ).toBe(false);
    expect(
      evaluateCondition({ field: "raw_sql", operator: "eq", value: "SELECT 1" }, baseSnapshot),
    ).toBe(false);
  });

  it("rejects invalid operators", () => {
    expect(
      evaluateCondition(
        { field: "LEAD_STATUS", operator: "exec" as "eq", value: "QUALIFIED" },
        baseSnapshot,
      ),
    ).toBe(false);
  });

  it("supports in/not_in and numeric comparisons", () => {
    expect(
      evaluateCondition({ field: "SOURCE", operator: "in", value: ["FORM", "IMPORT"] }, baseSnapshot),
    ).toBe(true);
    expect(
      evaluateCondition({ field: "CONSENT", operator: "exists" }, baseSnapshot),
    ).toBe(true);
  });
});

describe("delay computation", () => {
  it("computes fixed duration resume time", () => {
    const from = new Date("2026-07-30T10:00:00.000Z");
    const resumeAt = computeDelayResumeAt({ delayType: "FIXED_DURATION", durationMinutes: 60 }, from);
    expect(resumeAt.getTime()).toBe(from.getTime() + 60 * 60_000);
  });

  it("respects maxWaitMinutes cap", () => {
    const from = new Date("2026-07-30T10:00:00.000Z");
    const resumeAt = computeDelayResumeAt(
      { delayType: "WAIT_FOR_EVENT", waitEventType: "EMAIL_OPENED", maxWaitMinutes: 30 },
      from,
    );
    expect(resumeAt.getTime()).toBe(from.getTime() + 30 * 60_000);
  });

  it("uses until datetime when configured", () => {
    const from = new Date("2026-07-30T10:00:00.000Z");
    const target = "2026-08-01T09:00:00.000Z";
    const resumeAt = computeDelayResumeAt({ delayType: "UNTIL_DATETIME", untilAt: target }, from);
    expect(resumeAt.toISOString()).toBe(target);
  });
});

describe("exit rules", () => {
  const messagingRules = [
    { exitReason: "CONSENT_WITHDRAWN" as const, evaluateBeforeMessaging: true },
    { exitReason: "LEAD_SUPPRESSED" as const, evaluateBeforeMessaging: true },
  ];

  it("exits on consent withdrawal before messaging", () => {
    const result = shouldExitBeforeAction(messagingRules, {
      snapshot: baseSnapshot,
      suppressed: false,
      unsubscribed: false,
      consentMarketing: false,
    });
    expect(result.exit).toBe(true);
    expect(result.reason).toBe("CONSENT_WITHDRAWN");
  });

  it("exits on suppression before messaging", () => {
    const result = shouldExitBeforeAction(messagingRules, {
      snapshot: baseSnapshot,
      suppressed: true,
      unsubscribed: false,
      consentMarketing: true,
    });
    expect(result.exit).toBe(true);
    expect(result.reason).toBe("LEAD_SUPPRESSED");
  });

  it("exits before email when lead is unsubscribed", () => {
    const result = shouldExitBeforeAction(messagingRules, {
      snapshot: baseSnapshot,
      suppressed: false,
      unsubscribed: true,
      consentMarketing: true,
    });
    expect(result.exit).toBe(true);
    expect(result.reason).toBe("LEAD_SUPPRESSED");
  });

  it("allows messaging when consent and suppression are clear", () => {
    const result = shouldExitBeforeAction(messagingRules, {
      snapshot: baseSnapshot,
      suppressed: false,
      unsubscribed: false,
      consentMarketing: true,
    });
    expect(result.exit).toBe(false);
  });
});

describe("duplicate enrollment", () => {
  it("blocks active duplicate enrollment", () => {
    const result = checkDuplicateEnrollment("auto-1", "lead-1", [
      { automationId: "auto-1", leadId: "lead-1", status: "ACTIVE", enrolledAt: new Date() },
    ]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("already actively enrolled");
  });

  it("allows re-enrollment when prior enrollment completed", () => {
    const result = checkDuplicateEnrollment("auto-1", "lead-1", [
      { automationId: "auto-1", leadId: "lead-1", status: "COMPLETED", enrolledAt: new Date() },
    ]);
    expect(result.allowed).toBe(true);
  });
});

describe("cycle detection", () => {
  it("detects bounded cycles in graph", () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: "a", type: "ACTION" },
        { id: "b", type: "ACTION" },
        { id: "c", type: "ACTION" },
      ],
      edges: [
        { id: "e1", sourceNodeId: "a", targetNodeId: "b" },
        { id: "e2", sourceNodeId: "b", targetNodeId: "c" },
        { id: "e3", sourceNodeId: "c", targetNodeId: "a" },
      ],
    };
    const result = detectCycles(graph);
    expect(result.hasCycle).toBe(true);
    expect(result.path?.length).toBeGreaterThan(0);
  });

  it("passes acyclic graphs", () => {
    const result = detectCycles(minimalGraph());
    expect(result.hasCycle).toBe(false);
  });
});

describe("version approval binding", () => {
  it("invalidates stale trigger hash", () => {
    const result = isApprovalValid(
      { status: "APPROVED", triggerHash: "abc", actionGraphHash: "def" },
      { triggerHash: "xyz", actionGraphHash: "def" },
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Trigger configuration");
  });

  it("accepts matching approval bindings", () => {
    const result = isApprovalValid(
      {
        status: "APPROVED",
        triggerHash: "abc",
        conditionGraphHash: "cond",
        actionGraphHash: "act",
        templateHash: "tpl",
        delayHash: "del",
        frequencyLimitHash: "freq",
        exitRuleHash: "exit",
      },
      {
        triggerHash: "abc",
        conditionGraphHash: "cond",
        actionGraphHash: "act",
        templateHash: "tpl",
        delayHash: "del",
        frequencyLimitHash: "freq",
        exitRuleHash: "exit",
      },
    );
    expect(result.valid).toBe(true);
  });
});

describe("repeat policy", () => {
  const prior = (status: "ACTIVE" | "COMPLETED" | "EXITED") => ({
    automationId: "auto-1",
    leadId: "lead-1",
    status,
    enrolledAt: new Date("2026-01-01"),
  });

  it("enforces one-time enrollment", () => {
    const result = checkRepeatPolicy("ONE_TIME", "auto-1", "lead-1", [prior("COMPLETED")]);
    expect(result.allowed).toBe(false);
  });

  it("allows repeat after completion exited", () => {
    const result = checkRepeatPolicy("ALLOW_REPEAT", "auto-1", "lead-1", [prior("EXITED")]);
    expect(result.allowed).toBe(true);
  });

  it("blocks repeat after completion for allow-after-completion policy", () => {
    const result = checkRepeatPolicy("ALLOW_AFTER_COMPLETION", "auto-1", "lead-1", [prior("COMPLETED")]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("already completed");
  });
});

describe("graph validation", () => {
  it("requires exactly one trigger and at least one end node", () => {
    const result = validateAutomationGraph({
      nodes: [{ id: "trigger", type: "TRIGGER" }],
      edges: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("END"))).toBe(true);
  });

  it("accepts a minimal valid graph", () => {
    const result = validateAutomationGraph(minimalGraph());
    expect(result.valid).toBe(true);
  });

  it("flags orphan nodes", () => {
    const graph = minimalGraph({
      nodes: [
        ...minimalGraph().nodes,
        { id: "orphan", type: "ACTION", config: { actionType: "CREATE_TASK" } },
      ],
    });
    const result = validateAutomationGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Orphan"))).toBe(true);
  });
});

describe("graph safety", () => {
  it("requires approval on high-risk actions", () => {
    const graph = minimalGraph({
      nodes: [
        { id: "trigger", type: "TRIGGER" },
        { id: "webhook", type: "ACTION", config: { actionType: "WEBHOOK", url: "https://api.cresco.example/webhooks/automation" } },
        { id: "end", type: "END" },
      ],
      edges: [
        { id: "e1", sourceNodeId: "trigger", targetNodeId: "webhook" },
        { id: "e2", sourceNodeId: "webhook", targetNodeId: "end" },
      ],
    });
    const result = validateGraphSafety(graph);
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes("requiresApproval"))).toBe(true);
  });
});

describe("automation permissions", () => {
  it("grants owners full automation access", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["automation.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["automation.approve"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["automation.activate"])).toBe(true);
  });

  it("grants marketers create and enroll without approve", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["automation.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["automation.enroll"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["automation.approve"])).toBe(false);
  });

  it("limits viewers to read only", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["automation.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["automation.create"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["automation.enroll"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["automation.pause"])).toBe(false);
  });
});
