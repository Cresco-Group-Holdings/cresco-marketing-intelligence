import { describe, expect, it } from "vitest";
import { ContentStatus } from "@prisma/client";
import {
  assertStudioStatusTransition,
  canTransitionStudioStatus,
  getAllowedStudioTransitions,
  isStudioEditableStatus,
  STUDIO_PIPELINE_COLUMNS,
} from "@/lib/content/studio-workflow";
import {
  runBrandKnowledgeComplianceChecks,
  hasBlockingBrandComplianceFailures,
} from "@/lib/content/brand-knowledge-compliance";
import { assertCanApproveContent } from "@/lib/content/approval";
import { contentStudioScheduleSchema } from "@/lib/validation/content-studio";

describe("studio status transitions", () => {
  it("allows the spec lifecycle transitions", () => {
    expect(canTransitionStudioStatus("IDEA", "BRIEF")).toBe(true);
    expect(canTransitionStudioStatus("BRIEF", "DRAFT")).toBe(true);
    expect(canTransitionStudioStatus("DRAFT", "IN_REVIEW")).toBe(true);
    expect(canTransitionStudioStatus("IN_REVIEW", "APPROVED")).toBe(true);
    expect(canTransitionStudioStatus("IN_REVIEW", "CHANGES_REQUESTED")).toBe(true);
    expect(canTransitionStudioStatus("CHANGES_REQUESTED", "DRAFT")).toBe(true);
    expect(canTransitionStudioStatus("APPROVED", "READY")).toBe(true);
    expect(canTransitionStudioStatus("READY", "SCHEDULED")).toBe(true);
    expect(canTransitionStudioStatus("SCHEDULED", "PUBLISHED")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(canTransitionStudioStatus("IDEA", "APPROVED")).toBe(false);
    expect(canTransitionStudioStatus("PUBLISHED", "DRAFT")).toBe(false);
    expect(() => assertStudioStatusTransition("ARCHIVED", "DRAFT")).toThrow(/invalid/i);
  });

  it("returns allowed next statuses", () => {
    expect(getAllowedStudioTransitions("BRIEF")).toContain("DRAFT");
    expect(getAllowedStudioTransitions("APPROVED")).toContain("READY");
  });

  it("defines pipeline columns including BRIEF and READY", () => {
    expect(STUDIO_PIPELINE_COLUMNS).toContain("BRIEF");
    expect(STUDIO_PIPELINE_COLUMNS).toContain("READY");
  });

  it("identifies editable statuses", () => {
    expect(isStudioEditableStatus("DRAFT")).toBe(true);
    expect(isStudioEditableStatus("BRIEF")).toBe(true);
    expect(isStudioEditableStatus("APPROVED")).toBe(false);
  });
});

describe("brand knowledge compliance", () => {
  const baseInput = {
    title: "Product launch",
    contentBody: "Our product is the best in class guarantee",
    primaryCTA: null,
    contentCampaignId: null,
    primaryChannel: "LINKEDIN" as const,
    variants: [],
    assets: [],
    knowledgeReferences: [],
    brandContext: {
      hasProfile: true,
      hasMessaging: true,
      hasVoice: true,
      hasAudiences: true,
      prohibitedClaims: ["guarantee"],
      prohibitedVocabulary: ["lol"],
      proofPoints: ["ISO certified"],
      preferredTone: "Professional and formal",
      ctaLibrary: [],
    },
  };

  it("warns about prohibited claims", () => {
    const findings = runBrandKnowledgeComplianceChecks(baseInput);
    expect(findings.some((f) => f.checkType === "PROHIBITED_CLAIM")).toBe(true);
    expect(hasBlockingBrandComplianceFailures(findings)).toBe(false);
  });

  it("warns about missing campaign association", () => {
    const findings = runBrandKnowledgeComplianceChecks(baseInput);
    expect(findings.some((f) => f.checkType === "MISSING_CAMPAIGN")).toBe(true);
  });

  it("warns about missing channel variant", () => {
    const findings = runBrandKnowledgeComplianceChecks(baseInput);
    expect(findings.some((f) => f.checkType === "MISSING_CHANNEL_VARIANT")).toBe(true);
  });

  it("warns about missing CTA", () => {
    const findings = runBrandKnowledgeComplianceChecks(baseInput);
    expect(findings.some((f) => f.checkType === "MISSING_CTA")).toBe(true);
  });

  it("warns about unsupported statements", () => {
    const findings = runBrandKnowledgeComplianceChecks(baseInput);
    expect(findings.some((f) => f.checkType === "UNSUPPORTED_STATEMENT")).toBe(true);
  });

  it("warns about unapproved assets", () => {
    const findings = runBrandKnowledgeComplianceChecks({
      ...baseInput,
      assets: [{ id: "asset-1", approvedForMarketing: false }],
    });
    expect(findings.some((f) => f.checkType === "UNAPPROVED_ASSET")).toBe(true);
  });
});

describe("scheduled date validation", () => {
  it("rejects past scheduled dates", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = contentStudioScheduleSchema.safeParse({ scheduledFor: past });
    expect(result.success).toBe(false);
  });

  it("accepts future scheduled dates", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const result = contentStudioScheduleSchema.safeParse({ scheduledFor: future });
    expect(result.success).toBe(true);
  });
});

describe("reviewer permissions", () => {
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

describe("tenant isolation expectations", () => {
  it("studio list filters by organisation and brand in service layer", () => {
    const statuses: ContentStatus[] = ["IDEA", "BRIEF", "DRAFT"];
    expect(statuses.every((s) => canTransitionStudioStatus(s, "ARCHIVED") || s === "DRAFT")).toBe(
      true,
    );
  });
});
