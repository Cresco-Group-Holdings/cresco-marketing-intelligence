import { describe, expect, it } from "vitest";
import {
  computeBlockedStatus,
  isTaskOverdue,
  wouldCreateDependencyCycle,
} from "@/lib/tasks/dependencies";
import { buildTaskReminderCandidate, buildApprovalReminderCandidate } from "@/lib/tasks/reminders";

describe("task dependency cycles", () => {
  it("detects self-referencing cycles", () => {
    expect(wouldCreateDependencyCycle("a", "a", [])).toBe(true);
  });

  it("detects indirect cycles", () => {
    const edges = [
      { taskId: "b", dependsOnTaskId: "a" },
      { taskId: "c", dependsOnTaskId: "b" },
    ];
    expect(wouldCreateDependencyCycle("a", "c", edges)).toBe(true);
  });

  it("allows valid dependencies", () => {
    const edges = [{ taskId: "b", dependsOnTaskId: "a" }];
    expect(wouldCreateDependencyCycle("c", "a", edges)).toBe(false);
  });
});

describe("blocked state calculation", () => {
  it("marks task as blocked when dependency is incomplete", () => {
    const status = computeBlockedStatus(
      { id: "task-1", status: "TODO" },
      [{ dependsOnTask: { id: "dep-1", status: "IN_PROGRESS" } }],
    );
    expect(status).toBe("BLOCKED");
  });

  it("unblocks when all dependencies are done", () => {
    const status = computeBlockedStatus(
      { id: "task-1", status: "BLOCKED" },
      [{ dependsOnTask: { id: "dep-1", status: "DONE" } }],
    );
    expect(status).toBe("TODO");
  });

  it("preserves terminal statuses", () => {
    expect(
      computeBlockedStatus({ id: "t", status: "DONE" }, [
        { dependsOnTask: { id: "d", status: "TODO" } },
      ]),
    ).toBe("DONE");
  });
});

describe("overdue detection", () => {
  it("detects overdue open tasks", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(isTaskOverdue(past, "TODO")).toBe(true);
  });

  it("ignores completed tasks", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(isTaskOverdue(past, "DONE")).toBe(false);
  });
});

describe("reminder contract", () => {
  it("builds overdue reminder candidates", () => {
    const past = new Date(Date.now() - 3_600_000);
    const candidate = buildTaskReminderCandidate({
      id: "task-1",
      organisationId: "org-1",
      brandId: "brand-1",
      assigneeUserId: "user-1",
      reporterUserId: "user-2",
      title: "Review content",
      dueAt: past,
    });
    expect(candidate?.reminderType).toBe("OVERDUE");
  });

  it("builds approval pending reminder", () => {
    const created = new Date(Date.now() - 48 * 3_600_000);
    const candidate = buildApprovalReminderCandidate({
      id: "approval-1",
      organisationId: "org-1",
      brandId: "brand-1",
      requesterUserId: "user-1",
      title: "Approve campaign",
      type: "CAMPAIGN_ACTIVATION",
      createdAt: created,
    });
    expect(candidate.reminderType).toBe("PENDING_REVIEW");
    expect(candidate.hoursPending).toBeGreaterThan(40);
  });
});
