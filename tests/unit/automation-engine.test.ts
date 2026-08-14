import { describe, expect, it } from "vitest";
import { validateActionConfig, canTransitionCampaignStatus, buildDryRunPlan } from "@/lib/automation-engine/actions";
import { evaluateCondition, evaluateAllConditions } from "@/lib/automation-engine/conditions";
import {
  buildIdempotencyKey,
  canTriggerWorkflow,
  checkDailyExecutionLimit,
  checkMonthlyQuota,
  shouldDeadLetter,
} from "@/lib/automation-engine/safety";
import { matchesEventTrigger } from "@/lib/automation-engine/triggers";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { OrganisationRole } from "@prisma/client";

describe("automation engine conditions", () => {
  it("evaluates deterministic field comparisons", () => {
    expect(
      evaluateCondition(
        { field: "campaign.status", operator: "equals", value: "ACTIVE" },
        { campaign: { status: "ACTIVE" } },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "lead.score", operator: "greater_or_equal", value: 80 },
        { lead: { score: 85 } },
      ),
    ).toBe(true);
  });

  it("requires all conditions to pass", () => {
    const pass = evaluateAllConditions(
      [
        { field: "campaign.status", operator: "equals", value: "ACTIVE" },
        { field: "deadline.daysUntil", operator: "less_or_equal", value: 3 },
      ],
      { campaign: { status: "ACTIVE" }, deadline: { daysUntil: 2 } },
    );
    expect(pass).toBe(true);
  });
});

describe("automation engine actions", () => {
  it("validates whitelisted action configs", () => {
    const valid = validateActionConfig("CREATE_TASK", { title: "Launch checklist" });
    expect(valid.valid).toBe(true);

    const invalid = validateActionConfig("CREATE_TASK", {});
    expect(invalid.valid).toBe(false);
  });

  it("restricts campaign status transitions", () => {
    expect(canTransitionCampaignStatus("PLANNED", "ACTIVE")).toBe(true);
    expect(canTransitionCampaignStatus("COMPLETED", "ACTIVE")).toBe(false);
  });

  it("builds dry-run plans without executing", () => {
    const plan = buildDryRunPlan([
      { actionType: "CREATE_NOTIFICATION", config: { title: "Alert", recipientUserIds: ["u1"] } },
    ]);
    expect(plan[0].actionType).toBe("CREATE_NOTIFICATION");
  });
});

describe("automation engine safety", () => {
  it("builds stable idempotency keys", () => {
    expect(buildIdempotencyKey("wf-1", "CAMPAIGN_ACTIVATED", "camp-1")).toBe(
      "wf-1:CAMPAIGN_ACTIVATED:camp-1",
    );
  });

  it("prevents infinite self-trigger loops", () => {
    const blocked = canTriggerWorkflow({
      preventSelfTrigger: true,
      triggerDepth: 0,
      sourceWorkflowId: "wf-1",
      targetWorkflowId: "wf-1",
      eventType: "MANUAL",
    });
    expect(blocked.allowed).toBe(false);
  });

  it("enforces trigger depth limits", () => {
    const blocked = canTriggerWorkflow({
      preventSelfTrigger: false,
      triggerDepth: 3,
      targetWorkflowId: "wf-2",
      eventType: "LEAD_SCORE_THRESHOLD",
    });
    expect(blocked.allowed).toBe(false);
  });

  it("checks execution limits and quotas", () => {
    expect(checkDailyExecutionLimit(499, 500).allowed).toBe(true);
    expect(checkDailyExecutionLimit(500, 500).allowed).toBe(false);
    expect(checkMonthlyQuota(4999, 5000).allowed).toBe(true);
    expect(checkMonthlyQuota(5000, 5000).allowed).toBe(false);
  });

  it("dead-letters after max attempts", () => {
    expect(shouldDeadLetter(3, 3)).toBe(true);
    expect(shouldDeadLetter(2, 3)).toBe(false);
  });
});

describe("automation engine triggers", () => {
  it("matches event triggers", () => {
    expect(matchesEventTrigger("CAMPAIGN_ACTIVATED", "CAMPAIGN_ACTIVATED")).toBe(true);
    expect(matchesEventTrigger("CONTENT_ENTERED_REVIEW", "CAMPAIGN_ACTIVATED")).toBe(false);
  });
});

describe("automation engine permissions", () => {
  it("restricts execution to privileged roles", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["automationEngine.execute"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["automationEngine.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["automationEngine.execute"])).toBe(true);
  });
});
