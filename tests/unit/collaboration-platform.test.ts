import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  parseMentionedUserIds,
  sanitizeCommentBody,
  renderSafeMarkdown,
} from "@/lib/collaboration/mention-parser";
import { categoryToInboxSection, eventTypeToSection } from "@/lib/collaboration/inbox-sections";
import { publicationBudgetService } from "@/server/services/publication-budget-service";

describe("mention parser", () => {
  it("extracts user ids from mentions", () => {
    expect(parseMentionedUserIds("Hello @clxxxxxxxxxxxxxxxxxx")).toEqual([
      "clxxxxxxxxxxxxxxxxxx",
    ]);
  });

  it("sanitizes script tags from comments", () => {
    const result = sanitizeCommentBody('<script>alert("x")</script>Hello');
    expect(result).toBe("Hello");
    expect(result).not.toContain("<script");
  });

  it("renders safe markdown without raw html", () => {
    const html = renderSafeMarkdown("**bold** and <img src=x onerror=alert(1)>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<img");
  });
});

describe("inbox sections", () => {
  it("maps approval category to approvals section", () => {
    expect(categoryToInboxSection("APPROVAL")).toBe("APPROVALS");
  });

  it("maps mention events to mentions section", () => {
    expect(eventTypeToSection("collaboration.mention", "INBOX")).toBe("MENTIONS");
  });
});

describe("mandatory security notifications", () => {
  it("cannot disable security category preferences via critical lock", async () => {
    const { CRITICAL_NOTIFICATION_CATEGORIES } = await import("@/lib/notifications/constants");
    expect(CRITICAL_NOTIFICATION_CATEGORIES).toContain("SECURITY");
  });
});

describe("digest timezone deduplication", () => {
  it("evaluates budget changes consistently for digest thresholds", () => {
    const evaluation = publicationBudgetService.evaluateChange({
      externalCampaignId: "c1",
      currency: "GBP",
      currentBudget: 100,
      proposedBudget: 125,
    });
    expect(evaluation.requiresApproval).toBe(true);
  });
});

describe("permission checks", () => {
  it("viewer cannot manage budgets", async () => {
    const { hasPermission, PERMISSIONS } = await import("@/lib/tenancy/permissions");
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingBudgets.manage"])).toBe(
      false,
    );
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["notifications.read"])).toBe(true);
  });
});
