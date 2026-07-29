import { beforeEach, describe, expect, it, vi } from "vitest";
import { leadsTenantContext, leadsTestIds } from "../helpers/leads-mocks";

const prismaMock = vi.hoisted(() => ({
  marketingLead: { findFirst: vi.fn() },
}));

const aiMock = vi.hoisted(() => ({ executeStructured: vi.fn() }));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/ai-request-service", () => ({ aiRequestService: aiMock }));
vi.mock("@/lib/ai/brand-context-builder", () => ({
  brandContextBuilder: {
    build: vi.fn().mockReturnValue({ brandName: "Test Brand", compliance: [] }),
  },
}));
vi.mock("@/server/services/brand-knowledge-service", () => ({
  brandKnowledgeService: {
    getSnapshot: vi.fn().mockResolvedValue({} as never),
  },
}));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: leadsTestIds.brandId,
      projectId: leadsTestIds.projectId,
    }),
  },
}));

import { leadQualificationSuggestionService } from "@/server/services/lead-qualification-suggestion-service";

describe("leadQualificationSuggestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.marketingLead.findFirst.mockResolvedValue({
      id: leadsTestIds.leadId,
      displayName: "Alex",
      company: "Acme",
      expressedInterest: "Grant funding",
      source: { creationSource: "SOCIAL_COMMENT" },
    });
    aiMock.executeStructured.mockResolvedValue({
      output: {
        profile: "CRESCO_GRANTS_INTELLIGENCE",
        suggestedQualified: true,
        confidence: "MEDIUM",
        answers: { organisationType: "SME", fundingNeed: "R&D" },
        rationale: "Mentions grant funding.",
        requiresHumanReview: true,
      },
      aiRequestId: "ai-req-1",
    });
  });

  it("returns AI suggestions for human review without auto-applying qualification", async () => {
    const result = await leadQualificationSuggestionService.suggest(
      leadsTestIds.brandId,
      leadsTestIds.organisationId,
      leadsTestIds.leadId,
      { profile: "CRESCO_GRANTS_INTELLIGENCE" },
      leadsTenantContext,
    );

    expect(result.autoApplied).toBe(false);
    expect(result.suggestion.requiresHumanReview).toBe(true);
    expect(result.suggestion.answers.organisationType).toBe("SME");
  });
});
