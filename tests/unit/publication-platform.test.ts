import { describe, expect, it } from "vitest";
import { adaptContentForProvider } from "@/lib/publishing/content-adaptation";
import { evaluatePublicationGovernance } from "@/lib/publishing/publication-governance";
import { publicationBudgetService } from "@/server/services/publication-budget-service";
import { OrganisationRole } from "@prisma/client";

describe("content adaptation", () => {
  it("rejects captions that exceed provider limits", () => {
    const result = adaptContentForProvider({
      providerKey: "x",
      operationType: "SOCIAL_PUBLISH_POST",
      caption: "a".repeat(300),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "CAPTION_TOO_LONG")).toBe(true);
  });

  it("warns about long preheader without removing content", () => {
    const result = adaptContentForProvider({
      providerKey: "resend",
      operationType: "EMAIL_CREATE_CONTENT",
      preheader: "a".repeat(300),
    });
    expect(result.warnings.some((warning) => warning.requiresConfirmation)).toBe(true);
  });

  it("requires image assets for image publish operations", () => {
    const result = adaptContentForProvider({
      providerKey: "instagram",
      operationType: "SOCIAL_PUBLISH_IMAGE",
      imageCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});

describe("publication governance", () => {
  const baseInput = {
    organisationRole: OrganisationRole.ADMIN,
    operationType: "SOCIAL_PUBLISH_POST" as const,
    contentStatus: "APPROVED",
    compliancePassed: true,
    complianceOverridden: false,
    assetsReady: true,
    connectionStatus: "CONNECTED",
    connectionRevoked: false,
    externalAccountId: "acct-1",
    destinationAccountId: "acct-1",
    timezone: "UTC",
    adaptation: adaptContentForProvider({
      providerKey: "mock-social",
      operationType: "SOCIAL_PUBLISH_POST",
      caption: "Hello",
      imageCount: 1,
    }),
    budgetApproved: true,
    humanApprovalRequired: true,
    publicationApproved: false,
    emergencyShutdown: false,
  };

  it("blocks unapproved content", () => {
    const result = evaluatePublicationGovernance({
      ...baseInput,
      contentStatus: "DRAFT",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("Content must be approved before publication.");
  });

  it("requires human approval for publish operations", () => {
    const result = evaluatePublicationGovernance(baseInput);
    expect(result.requiresApproval).toBe(true);
    expect(result.blockers).toContain("Human approval is required before execution.");
  });

  it("blocks cross-tenant destination mismatch", () => {
    const result = evaluatePublicationGovernance({
      ...baseInput,
      destinationAccountId: "other-acct",
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks expired connections", () => {
    const result = evaluatePublicationGovernance({
      ...baseInput,
      connectionRevoked: true,
    });
    expect(result.blockers).toContain("Provider connection has been revoked.");
  });

  it("blocks past schedule times", () => {
    const result = evaluatePublicationGovernance({
      ...baseInput,
      scheduledFor: new Date(Date.now() - 60_000),
    });
    expect(result.blockers).toContain("Scheduled time must be in the future.");
  });
});

describe("publication budget controls", () => {
  it("requires approval above threshold", () => {
    const evaluation = publicationBudgetService.evaluateChange({
      externalCampaignId: "camp-1",
      currency: "GBP",
      currentBudget: 100,
      proposedBudget: 150,
    });
    expect(evaluation.requiresApproval).toBe(true);
    expect(evaluation.warning).toMatch(/50\.0%/);
  });

  it("allows small budget adjustments without approval", () => {
    const evaluation = publicationBudgetService.evaluateChange({
      externalCampaignId: "camp-1",
      currency: "GBP",
      currentBudget: 100,
      proposedBudget: 110,
    });
    expect(evaluation.requiresApproval).toBe(false);
  });
});
