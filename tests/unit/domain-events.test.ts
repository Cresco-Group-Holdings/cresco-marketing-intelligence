import { describe, expect, it } from "vitest";
import { DOMAIN_EVENT_TYPES } from "@/lib/domain-events/constants";
import { mapDomainEventToAutomation } from "@/lib/domain-events/map-to-automation";
import { AUTOMATION_ACTION_CLASSIFICATION } from "@/lib/automation-engine/action-classification";
import { buildIdempotencyKey, canTriggerWorkflow } from "@/lib/automation-engine/safety";

describe("domain event mapping", () => {
  it("maps publication.failed to automation trigger type", () => {
    expect(mapDomainEventToAutomation(DOMAIN_EVENT_TYPES.PUBLICATION_FAILED)).toBe(
      "PUBLICATION_FAILED",
    );
  });

  it("maps publication.succeeded to automation trigger type", () => {
    expect(mapDomainEventToAutomation(DOMAIN_EVENT_TYPES.PUBLICATION_SUCCEEDED)).toBe(
      "PUBLICATION_SUCCEEDED",
    );
  });

  it("returns null for unmapped events", () => {
    expect(mapDomainEventToAutomation(DOMAIN_EVENT_TYPES.OPPORTUNITY_CHANGED)).toBeNull();
  });
});

describe("automation action classification", () => {
  it("marks high-impact campaign changes as approval required", () => {
    expect(AUTOMATION_ACTION_CLASSIFICATION.UPDATE_CAMPAIGN_STATUS).toBe("approval_required");
    expect(AUTOMATION_ACTION_CLASSIFICATION.REQUEST_APPROVAL).toBe("approval_required");
  });

  it("marks notifications and tasks as executable", () => {
    expect(AUTOMATION_ACTION_CLASSIFICATION.CREATE_NOTIFICATION).toBe("executable");
    expect(AUTOMATION_ACTION_CLASSIFICATION.CREATE_TASK).toBe("executable");
  });
});

describe("automation loop protection", () => {
  it("blocks self-triggering workflows", () => {
    const result = canTriggerWorkflow({
      preventSelfTrigger: true,
      triggerDepth: 1,
      sourceWorkflowId: "wf-1",
      targetWorkflowId: "wf-1",
      eventType: "PUBLICATION_FAILED",
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks excessive trigger depth", () => {
    const result = canTriggerWorkflow({
      preventSelfTrigger: true,
      triggerDepth: 3,
      targetWorkflowId: "wf-2",
      eventType: "PUBLICATION_FAILED",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("automation idempotency keys", () => {
  it("builds stable keys for duplicate event prevention", () => {
    const keyA = buildIdempotencyKey("wf-1", "PUBLICATION_FAILED", "job-1");
    const keyB = buildIdempotencyKey("wf-1", "PUBLICATION_FAILED", "job-1");
    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(buildIdempotencyKey("wf-1", "PUBLICATION_FAILED", "job-2"));
  });
});
