import { describe, expect, it } from "vitest";
import { ContentStatus } from "@prisma/client";
import {
  assertContentStatusTransition,
  canTransitionContentStatus,
  getAllowedContentTransitions,
} from "@/lib/content/status-transitions";
import { hasBlockingComplianceFailures, runComplianceChecks } from "@/lib/content/compliance";
import { assertCanApproveContent } from "@/lib/content/approval";

describe("content status transitions", () => {
  it("allows valid transitions", () => {
    expect(canTransitionContentStatus("IDEA", "DRAFT")).toBe(true);
    expect(canTransitionContentStatus("DRAFT", "IN_REVIEW")).toBe(true);
    expect(canTransitionContentStatus("IN_REVIEW", "APPROVED")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(canTransitionContentStatus("IDEA", "APPROVED")).toBe(false);
    expect(() => assertContentStatusTransition("ARCHIVED", "DRAFT")).toThrow(/invalid/i);
  });

  it("returns allowed next statuses", () => {
    expect(getAllowedContentTransitions("DRAFT")).toContain("IN_REVIEW");
  });
});

describe("content compliance", () => {
  it("flags missing destination URL for article links", () => {
    const findings = runComplianceChecks({
      contentType: "ARTICLE_LINK",
      destinationUrl: null,
      variants: [],
      assets: [],
    });
    expect(findings.some((f) => f.checkType === "MISSING_DESTINATION_URL")).toBe(true);
    expect(hasBlockingComplianceFailures(findings)).toBe(true);
  });

  it("flags unsupported platform formats", () => {
    const findings = runComplianceChecks({
      contentType: "TEXT_POST",
      variants: [
        {
          id: "variant-1",
          provider: "TIKTOK",
          format: "TEXT_POST",
          caption: "Hello",
        },
      ],
      assets: [],
    });
    expect(findings.some((f) => f.checkType === "UNSUPPORTED_PLATFORM_FORMAT")).toBe(true);
  });
});

describe("content approval separation of duties", () => {
  it("prevents creators approving their own content", () => {
    expect(() =>
      assertCanApproveContent({
        settings: { approvalMode: "ONE_APPROVER", separationOfDutiesEnabled: true },
        approverUserId: "user-1",
        createdByUserId: "user-1",
        ownerUserId: "user-2",
      }),
    ).toThrow(/cannot approve their own content/i);
  });
});
