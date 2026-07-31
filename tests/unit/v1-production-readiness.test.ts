import { describe, expect, it } from "vitest";
import {
  BLOCKED_AUTONOMOUS_ACTIONS,
  NO_AUTONOMOUS_ACTION_DISCLAIMER as LIFECYCLE_NO_AUTONOMOUS_DISCLAIMER,
  LIFECYCLE_DISCLAIMER,
  PROHIBITED_COMMERCIAL_ACTIONS,
} from "@/lib/lifecycle-agent/constants";
import {
  NO_AUTONOMOUS_ACTION_DISCLAIMER as ADVERTISING_NO_AUTONOMOUS_DISCLAIMER,
  OPTIMISATION_DISCLAIMER,
} from "@/lib/advertising-optimisation/constants";
import {
  blockAutonomousPriceChange,
  blockAutonomousSend,
} from "@/lib/lifecycle-agent/guardrails";
import { validateAutomationGraph, type AutomationGraph } from "@/lib/marketing-automation/graph-validation";
import { detectCycles, validateGraphSafety } from "@/lib/marketing-automation/safety";
import { shouldBlockSend } from "@/lib/email/suppression";

function minimalGraph(overrides?: Partial<AutomationGraph>): AutomationGraph {
  return {
    nodes: [
      { id: "trigger", type: "TRIGGER" },
      { id: "action", type: "ACTION", config: { actionType: "CREATE_TASK" } },
      { id: "end", type: "END" },
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", targetNodeId: "action" },
      { id: "e2", sourceNodeId: "action", targetNodeId: "end" },
    ],
    ...overrides,
  };
}

describe("commercial safety constants", () => {
  it("prohibits autonomous send in commercial action list", () => {
    expect(PROHIBITED_COMMERCIAL_ACTIONS).toContain("AUTO_SEND_MESSAGE");
    expect(BLOCKED_AUTONOMOUS_ACTIONS).toContain("AUTO_SEND_MESSAGE");
  });

  it("prohibits autonomous price change in commercial action list", () => {
    expect(PROHIBITED_COMMERCIAL_ACTIONS).toContain("AUTO_PRICE_CHANGE");
    expect(BLOCKED_AUTONOMOUS_ACTIONS).toContain("AUTO_PRICE_CHANGE");
  });

  it("blocks autonomous send without approval", () => {
    expect(blockAutonomousSend(false).allowed).toBe(false);
    expect(blockAutonomousSend(false).reason).toContain("never sent autonomously");
  });

  it("blocks autonomous price changes without approval", () => {
    expect(blockAutonomousPriceChange(false).allowed).toBe(false);
    expect(blockAutonomousPriceChange(false).reason).toContain("never applied autonomously");
  });
});

describe("automation safety", () => {
  it("requires exactly one trigger and at least one end node", () => {
    const result = validateAutomationGraph({
      nodes: [{ id: "trigger", type: "TRIGGER" }],
      edges: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("END"))).toBe(true);
  });

  it("accepts a minimal valid graph", () => {
    expect(validateAutomationGraph(minimalGraph()).valid).toBe(true);
  });

  it("detects cycles in automation graphs", () => {
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

  it("passes acyclic graphs through cycle detection", () => {
    expect(detectCycles(minimalGraph()).hasCycle).toBe(false);
  });

  it("flags high-risk actions in graph safety validation", () => {
    const graph = minimalGraph({
      nodes: [
        { id: "trigger", type: "TRIGGER" },
        {
          id: "webhook",
          type: "ACTION",
          config: { actionType: "WEBHOOK", url: "https://api.example.com/hook" },
        },
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

describe("email suppression checks", () => {
  it("blocks marketing sends for suppressed addresses", () => {
    const block = shouldBlockSend(
      "MARKETING",
      { emailAddress: "a@b.com", reason: "UNSUBSCRIBE", suppressed: true },
      false,
    );
    expect(block.blocked).toBe(true);
    expect(block.reason).toBe("UNSUBSCRIBE");
  });

  it("blocks marketing sends for unsubscribed contacts", () => {
    const block = shouldBlockSend("MARKETING", null, true);
    expect(block.blocked).toBe(true);
  });

  it("allows transactional sends when suppression is clear", () => {
    const block = shouldBlockSend("ESSENTIAL_TRANSACTIONAL", null, false);
    expect(block.blocked).toBe(false);
  });

  it("blocks transactional sends for hard bounce suppressions", () => {
    const block = shouldBlockSend(
      "ESSENTIAL_TRANSACTIONAL",
      { emailAddress: "a@b.com", reason: "HARD_BOUNCE", suppressed: true },
      false,
    );
    expect(block.blocked).toBe(true);
    expect(block.reason).toBe("HARD_BOUNCE");
  });
});

describe("AI disclaimer presence", () => {
  it("includes lifecycle agent autonomous-action disclaimer", () => {
    expect(LIFECYCLE_NO_AUTONOMOUS_DISCLAIMER).toContain("must not autonomously");
    expect(LIFECYCLE_NO_AUTONOMOUS_DISCLAIMER).toContain("send messages");
    expect(LIFECYCLE_NO_AUTONOMOUS_DISCLAIMER).toContain("change pricing");
  });

  it("includes lifecycle agent evidence-grounded disclaimer", () => {
    expect(LIFECYCLE_DISCLAIMER).toContain("human approval");
    expect(LIFECYCLE_DISCLAIMER).toContain("No messages are sent");
  });

  it("includes advertising optimisation autonomous-action disclaimer", () => {
    expect(ADVERTISING_NO_AUTONOMOUS_DISCLAIMER).toContain("must not autonomously");
    expect(ADVERTISING_NO_AUTONOMOUS_DISCLAIMER).toContain("launch campaigns");
    expect(ADVERTISING_NO_AUTONOMOUS_DISCLAIMER).toContain("increase budgets");
  });

  it("includes advertising optimisation evidence-grounded disclaimer", () => {
    expect(OPTIMISATION_DISCLAIMER).toContain("human approval");
    expect(OPTIMISATION_DISCLAIMER).toContain("No campaign launches");
  });
});
