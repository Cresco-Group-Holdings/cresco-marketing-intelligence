import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentTenantContext, contentTestIds } from "../helpers/content-mocks";

const prismaMock = vi.hoisted(() => ({
  contentItem: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  contentVersion: { create: vi.fn(), findMany: vi.fn() },
  contentKnowledgeReference: { deleteMany: vi.fn(), createMany: vi.fn() },
  contentStatusHistory: { create: vi.fn() },
  contentProvenance: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  contentActivity: { create: vi.fn() },
  brandProfile: { findUnique: vi.fn() },
  brandMessage: { findUnique: vi.fn() },
  brandVoiceRule: { findUnique: vi.fn() },
  brandAudience: { count: vi.fn() },
  brandComplianceRule: { findMany: vi.fn() },
  aIRequest: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: contentTestIds.brandId,
      projectId: contentTestIds.projectId,
      name: "Test Brand",
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/services/brand-knowledge-service", () => ({
  brandKnowledgeService: {
    getSnapshot: vi.fn().mockResolvedValue({
      brand: { name: "Test Brand", description: "A test brand" },
      profile: { valueProposition: "Value", shortDescription: "Short" },
      messaging: {
        id: "msg-1",
        coreMessage: "Core",
        supportingMessages: [],
        prohibitedClaims: [],
        proofPoints: [],
        ctaLibrary: [],
      },
      voice: null,
      audiences: [],
      personas: [],
      offers: [],
      complianceRules: [],
    }),
  },
}));
vi.mock("@/server/services/ai-request-service", () => ({
  aiRequestService: {
    executeStructured: vi.fn(),
  },
}));
vi.mock("@/server/services/prompt-template-service", () => ({
  promptTemplateService: {
    getActiveTemplate: vi.fn().mockResolvedValue({ activeVersion: { id: "tpl-v1" } }),
  },
}));

import { aiRequestService } from "@/server/services/ai-request-service";
import { contentStudioBriefAiService } from "@/server/services/content-studio-brief-ai-service";
import { contentStudioService } from "@/server/services/content-studio-service";

const studioItem = {
  id: contentTestIds.contentId,
  organisationId: contentTestIds.organisationId,
  projectId: contentTestIds.projectId,
  brandId: contentTestIds.brandId,
  title: "Launch post",
  studioType: "SOCIAL_POST",
  contentType: "TEXT_POST",
  status: "IDEA",
  version: 1,
  studioObjective: null,
  audienceSummary: null,
  contentBody: null,
  primaryMessage: null,
  primaryCTA: null,
  primaryChannel: null,
  contentCampaignId: null,
  campaignName: null,
  dueAt: null,
  scheduledFor: null,
  timezone: null,
  ownerUserId: contentTenantContext.userProfileId,
  createdByUserId: contentTenantContext.userProfileId,
  approvedByUserId: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  variants: [],
  assets: [],
  knowledgeReferences: [],
  versions: [],
  reviews: [],
  comments: [],
  complianceChecks: [],
  provenance: {
    createdManually: true,
    aiProvider: null,
    aiModel: null,
    generatedAt: null,
    metadata: null,
  },
};

describe("contentStudioBriefAiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.aIRequest.findFirst.mockResolvedValue(null);
    prismaMock.contentProvenance.findUnique.mockResolvedValue({ metadata: null });
    prismaMock.contentProvenance.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock),
    );
    prismaMock.contentItem.update.mockResolvedValue({ ...studioItem, status: "BRIEF", version: 2 });
    vi.spyOn(contentStudioService, "getById").mockResolvedValue(studioItem as never);
    vi.spyOn(contentStudioService, "persistAiGeneratedBrief").mockResolvedValue({
      ...studioItem,
      status: "BRIEF",
      studioObjective: "Drive demo bookings",
      audienceSummary: "Marketing leaders",
      provenance: {
        createdManually: false,
        aiProvider: "OPENAI",
        aiModel: "gpt-test",
        generatedAt: new Date().toISOString(),
        briefGeneration: {
          phase: "brief",
          idempotencyKey: "idem-12345678",
          status: "completed",
          aiRequestId: "ai-1",
        },
        masterGeneration: null,
      },
    } as never);
    vi.spyOn(contentStudioService, "markBriefGenerationInProgress").mockResolvedValue(undefined);
    vi.spyOn(contentStudioService, "markBriefGenerationFailed").mockResolvedValue(undefined);
  });

  it("returns cached brief when idempotency key already completed", async () => {
    vi.spyOn(contentStudioService, "getById").mockResolvedValue({
      ...studioItem,
      status: "BRIEF",
      provenance: {
        createdManually: false,
        aiProvider: "OPENAI",
        aiModel: "gpt-test",
        generatedAt: new Date().toISOString(),
        briefGeneration: {
          phase: "brief",
          idempotencyKey: "idem-12345678",
          status: "completed",
          aiRequestId: "ai-existing",
        },
        masterGeneration: null,
      },
    } as never);

    const result = await contentStudioBriefAiService.generateBrief(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      contentTestIds.contentId,
      { idempotencyKey: "idem-12345678" },
      contentTenantContext,
    );

    expect(result.generation.cached).toBe(true);
    expect(aiRequestService.executeStructured).not.toHaveBeenCalled();
  });

  it("persists AI brief output with provenance on successful generation", async () => {
    vi.mocked(aiRequestService.executeStructured).mockResolvedValue({
      requestId: "req-1",
      aiRequestId: "ai-1",
      executionId: "exec-1",
      output: {
        title: "Launch post",
        studioObjective: "Drive demo bookings",
        audienceSummary: "Marketing leaders",
        keyMessages: ["Speed"],
        talkingPoints: ["Workflow automation"],
        toneGuidance: "Professional",
        primaryCTA: "Book a demo",
        channelRecommendations: [{ channel: "LinkedIn", rationale: "B2B reach" }],
        contentAngle: "Outcome-led",
        successMetrics: ["Demo requests"],
        complianceNotes: [],
        limitations: "None",
      },
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      estimatedCostUsd: 0.01,
      latencyMs: 100,
      provider: "OPENAI",
      model: "gpt-test",
    });

    const result = await contentStudioBriefAiService.generateBrief(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      contentTestIds.contentId,
      { idempotencyKey: "idem-12345678" },
      contentTenantContext,
    );

    expect(contentStudioService.persistAiGeneratedBrief).toHaveBeenCalled();
    expect(result.generation.cached).toBe(false);
    expect(result.generation.aiRequestId).toBe("ai-1");
  });
});
