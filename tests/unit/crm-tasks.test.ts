import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { generateFollowUpProposal } from "@/lib/crm-tasks/ai-assistant";
import { DEFAULT_TASK_TYPE_LABELS } from "@/lib/crm-tasks/constants";
import {
  evaluateLeadRules,
  evaluateMeetingRules,
  evaluateOpportunityRules,
} from "@/lib/crm-tasks/follow-up-rules";
import {
  canAssignTask,
  canCompleteTask,
  isTaskOverdue,
  resolveDisplayStatus,
  validateTaskTransition,
} from "@/lib/crm-tasks/lifecycle";
import { buildTaskReminders, shouldNotifyReminder } from "@/lib/crm-tasks/reminders";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("task lifecycle", () => {
  const base = { id: "t1", status: "OPEN" as const, dueDate: null, deferredUntil: null, ownerUserId: "u1" };

  it("allows open to in progress", () => {
    expect(validateTaskTransition(base, "IN_PROGRESS").valid).toBe(true);
  });

  it("blocks transition from completed", () => {
    expect(validateTaskTransition({ ...base, status: "COMPLETED" }, "OPEN").valid).toBe(false);
  });

  it("requires deferredUntil for deferred status", () => {
    expect(validateTaskTransition(base, "DEFERRED").valid).toBe(false);
  });

  it("detects overdue tasks", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(isTaskOverdue({ ...base, dueDate: past })).toBe(true);
    expect(resolveDisplayStatus({ ...base, dueDate: past })).toBe("OVERDUE");
  });

  it("respects deferred until date", () => {
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    expect(isTaskOverdue({ ...base, status: "DEFERRED", dueDate: past, deferredUntil: future })).toBe(false);
  });
});

describe("task assignment permissions", () => {
  const task = { id: "t1", status: "OPEN" as const, dueDate: null, deferredUntil: null, ownerUserId: "u1" };

  it("allows admin to assign", () => {
    expect(canAssignTask(task, "u2", "ADMIN")).toBe(true);
  });

  it("blocks viewers from assigning", () => {
    expect(canAssignTask(task, "u2", "VIEWER")).toBe(false);
  });

  it("allows owner to assign", () => {
    expect(canAssignTask(task, "u1", "MARKETER")).toBe(true);
  });

  it("allows completion for open tasks", () => {
    expect(canCompleteTask(task)).toBe(true);
    expect(canCompleteTask({ ...task, status: "COMPLETED" })).toBe(false);
  });
});

describe("reminders", () => {
  it("schedules before-due and overdue reminders", () => {
    const dueDate = new Date(Date.now() + 7 * 86_400_000);
    const reminders = buildTaskReminders({ dueDate, minutesBefore: 240 });
    expect(reminders.some((r) => r.reminderType === "BEFORE_DUE")).toBe(true);
    expect(reminders.some((r) => r.reminderType === "OVERDUE")).toBe(true);
  });

  it("avoids duplicate notification", () => {
    expect(shouldNotifyReminder({ notifiedAt: new Date(), remindAt: new Date(Date.now() - 1000) })).toBe(false);
    expect(shouldNotifyReminder({ notifiedAt: null, remindAt: new Date(Date.now() - 1000) })).toBe(true);
  });
});

describe("follow-up rules", () => {
  it("flags new lead without owner", () => {
    const rules = evaluateLeadRules({
      id: "l1", status: "NEW", qualificationState: "UNASSESSED", ownerUserId: null,
      lastActivityAt: null, hasOpenTask: false, hasDemoRequest: false, hasRecentReply: false, hasResponseTask: false,
    });
    expect(rules.some((r) => r.trigger === "NEW_LEAD_NO_OWNER")).toBe(true);
  });

  it("flags qualified lead without task", () => {
    const rules = evaluateLeadRules({
      id: "l1", status: "QUALIFIED", qualificationState: "QUALIFIED", ownerUserId: "u1",
      lastActivityAt: new Date(), hasOpenTask: false, hasDemoRequest: false, hasRecentReply: false, hasResponseTask: false,
    });
    expect(rules.some((r) => r.trigger === "QUALIFIED_LEAD_NO_TASK")).toBe(true);
  });

  it("flags meeting without next step", () => {
    const rules = evaluateMeetingRules({
      id: "m1", outcome: "Positive", hasFollowUpTask: false, completedAt: new Date(),
    });
    expect(rules.some((r) => r.trigger === "MEETING_NO_NEXT_STEP")).toBe(true);
  });

  it("flags inactive opportunity", () => {
    const stale = new Date(Date.now() - 20 * 86_400_000);
    const rules = evaluateOpportunityRules({
      id: "o1", name: "Deal", status: "OPEN", lastActivityAt: stale, nextAction: null,
      hasOpenTask: false, expectedCloseDate: null,
    });
    expect(rules.some((r) => r.trigger === "OPPORTUNITY_INACTIVE")).toBe(true);
  });
});

describe("AI follow-up assistant", () => {
  it("requires consent", () => {
    expect(generateFollowUpProposal({
      consentGranted: false,
      recentActivities: [{ type: "CALL", occurredAt: new Date() }],
      openTasks: [],
    })).toBeNull();
  });

  it("requires CRM evidence", () => {
    expect(generateFollowUpProposal({
      consentGranted: true,
      recentActivities: [],
      openTasks: [],
    })).toBeNull();
  });

  it("produces grounded output without auto-send", () => {
    const proposal = generateFollowUpProposal({
      consentGranted: true,
      pipelineStage: "PROPOSAL",
      recentActivities: [{ type: "EMAIL", summary: "Asked about pricing", occurredAt: new Date() }],
      openTasks: [],
    });
    expect(proposal?.aiGrounded).toBe(true);
    expect(proposal?.autoSendBlocked).toBe(true);
    expect(proposal?.followUpDraft).toContain("Do not auto-send");
  });
});

describe("task permissions", () => {
  it("grants marketers task management", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["tasks.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["tasks.complete"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["aiFollowUp.generate"])).toBe(true);
  });

  it("limits viewers to read", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["tasks.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["tasks.create"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["followUps.manage"])).toBe(false);
  });
});

describe("task type catalogue", () => {
  it("includes all required types", () => {
    expect(Object.keys(DEFAULT_TASK_TYPE_LABELS)).toHaveLength(12);
  });
});
