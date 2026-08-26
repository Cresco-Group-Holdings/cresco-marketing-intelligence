import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentTestIds, contentTenantContext } from "../helpers/content-mocks";
import {
  buildBriefGenerationPrompt,
  buildMasterGenerationPrompt,
  assertSourceModeAllowed,
  mapObjectiveValue,
} from "@/lib/content-intelligence/generation-context";
import {
  buildProvenanceMetadata,
  parseContentIntelligenceProvenance,
} from "@/lib/content-intelligence/provenance";
import { contentIntelligenceBriefOutputSchema } from "@/lib/ai/content-output-schemas";
import { AppError } from "@/lib/errors";

const prismaMock = vi.hoisted(() => ({
  contentItem: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  contentProvenance: {
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  contentRevision: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  campaign: { findFirst: vi.fn() },
  growthRecommendation: { findFirst: vi.fn() },
  seoCompetitorPage: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const aiRequestServiceMock = vi.hoisted(() => ({
  executeStructured: vi.fn(),
}));

const brandKnowledgeServiceMock = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
}));

const contentStudioServiceMock = vi.hoisted(() => ({
  update: vi.fn(),
  runCompliance: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/ai-request-service", () => ({
  aiRequestService: aiRequestServiceMock,
}));
vi.mock("@/server/services/brand-knowledge-service", () => ({
  brandKnowledgeService: brandKnowledgeServiceMock,
}));
vi.mock("@/server/services/content-studio-service", () => ({
  contentStudioService: contentStudioServiceMock,
}));
vi.mock("@/server/services/prompt-template-service", () => ({
  promptTemplateService: {
    getActiveTemplate: vi.fn().mockResolvedValue({ activeVersion: { id: "tpl-v1" } }),
  },
}));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: contentTestIds.brandId,
      projectId: contentTestIds.projectId,
    }),
  },
}));

import { contentIntelligenceGenerationService } from "@/server/services/content-intelligence-generation-service";

const VALID_BRIEF_OUTPUT = {
  objective: "education",
  audienceSummary: "Startup founders",
  audiencePain: "Documentation uncertainty",
  keyMessage: "SEIS delays are preventable",
  supportingMessages: ["Plan early"],
  proofPoints: ["Observed patterns"],
  differentiators: ["Workflow clarity"],
  cta: "Check eligibility",
  channelStrategy: ["LINKEDIN"],
  suggestedFormats: ["carousel"],
};

const VALID_MASTER_OUTPUT = {
  title: "5 reasons SEIS applications get delayed",
  hook: "Most delays are preventable",
  body: "Documentation, structure, thresholds, qualification, timing.",
  keyPoints: ["Documentation", "Structure"],
  cta: "Check eligibility",
};

const BASE_BRIEF = {
  mode: "manual" as const,
  objective: "education" as const,
  keyMessage: "SEIS delays are preventable",
  supportingMessages: ["Plan early"],
  proofPoints: ["Observed patterns"],
  differentiators: ["Workflow clarity"],
  cta: "Check eligibility",
  channelStrategy: ["LINKEDIN"],
  suggestedFormats: ["carousel"],
  prohibitedClaims: [],
  evidenceNotes: [],
};

function mockBrandSnapshot() {
  brandKnowledgeServiceMock.getSnapshot.mockResolvedValue({
    brand: { id: contentTestIds.brandId, name: "Cresco", description: "Advisory" },
    profile: { id: "profile-1", valueProposition: "Funding guidance", shortDescription: null, mission: null },
    messaging: {
      id: "msg-1",
      coreMessage: "Expert guidance",
      supportingMessages: [],
      prohibitedClaims: ["guaranteed funding"],
      proofPoints: [],
      ctaLibrary: [],
    },
    voice: null,
    audiences: [{ id: "aud-1", name: "Founders", description: null, painPoints: [], motivations: [], preferredChannels: [], archivedAt: null }],
    personas: [],
    offers: [],
    competitors: [],
    complianceRules: [],
  });
}

describe("content intelligence generation context", () => {
  it("builds brief prompt with evidence guardrails", () => {
    const prompt = buildBriefGenerationPrompt(
      {
        mode: "manual",
        objective: "education",
        funnelStage: null,
        audienceId: null,
        audienceLabel: "Founders",
        offerId: null,
        offerLabel: null,
        campaignId: null,
        campaignLabel: null,
        contentPillar: "funding",
        sourceContentId: null,
        sourceOpportunityId: null,
        evidenceNotes: [],
        prohibitedClaims: [],
        brandContext: { brandName: "Cresco", identity: {}, compliance: [], usedRecords: [] },
      },
      null,
    );
    expect(prompt).toContain("Do not fabricate statistics");
    expect(prompt).toContain("Founders");
  });

  it("rejects competitor mode without evidence", () => {
    expect(() => assertSourceModeAllowed("competitor_signal", null)).toThrow(AppError);
  });

  it("maps objective aliases", () => {
    expect(mapObjectiveValue("lead_generation")).toBe("lead_generation");
    expect(mapObjectiveValue("Lead Generation")).toBe("lead_generation");
  });

  it("builds master prompt from persisted brief", () => {
    const prompt = buildMasterGenerationPrompt(BASE_BRIEF, "SOCIAL_POST");
    expect(prompt).toContain(BASE_BRIEF.keyMessage);
    expect(prompt).toContain("SOCIAL_POST");
  });
});

describe("content intelligence provenance", () => {
  it("round-trips versioned metadata", () => {
    const metadata = buildProvenanceMetadata({
      briefId: "content-1",
      creationMode: "manual",
      brandId: contentTestIds.brandId,
      structuredBrief: BASE_BRIEF,
      briefGeneration: {
        aiRequestId: "ai-1",
        provider: "OPENAI",
        model: "gpt-test",
        generatedAt: new Date().toISOString(),
        humanEdited: false,
        operationType: "brief_generation",
      },
    });
    const parsed = parseContentIntelligenceProvenance(metadata);
    expect(parsed?.structuredBrief.keyMessage).toBe(BASE_BRIEF.keyMessage);
    expect(parsed?.schemaVersion).toBe(1);
  });

  it("rejects malformed provenance metadata", () => {
    expect(parseContentIntelligenceProvenance({ foo: "bar" })).toBeNull();
  });
});

describe("contentIntelligenceGenerationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrandSnapshot();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });
    prismaMock.contentRevision.findFirst.mockResolvedValue(null);
    contentStudioServiceMock.runCompliance.mockResolvedValue({ findings: [] });
  });

  it("generates and persists a validated brief", async () => {
    aiRequestServiceMock.executeStructured.mockResolvedValue({
      aiRequestId: "ai-brief-1",
      provider: "OPENAI",
      model: "gpt-test",
      output: VALID_BRIEF_OUTPUT,
    });
    prismaMock.contentItem.create.mockResolvedValue({
      id: "content-brief-1",
      status: "BRIEF",
      version: 1,
      title: "SEIS delays are preventable",
      contentBody: null,
      primaryCTA: "Check eligibility",
      contentPillar: null,
      audienceSummary: "Startup founders",
      studioObjective: "education",
      campaignName: null,
      complianceChecks: [],
    });
    prismaMock.contentProvenance.create.mockResolvedValue({ id: "prov-1" });
    prismaMock.contentProvenance.findFirst.mockResolvedValue({
      id: "prov-1",
      metadata: buildProvenanceMetadata({
        briefId: "content-brief-1",
        creationMode: "manual",
        brandId: contentTestIds.brandId,
        structuredBrief: { ...BASE_BRIEF, audienceLabel: "Startup founders", audiencePain: "Documentation uncertainty" },
      }),
    });
    prismaMock.contentItem.findFirst.mockResolvedValue({
      id: "content-brief-1",
      status: "BRIEF",
      version: 1,
      title: "SEIS delays are preventable",
      contentBody: null,
      primaryCTA: "Check eligibility",
      contentPillar: null,
      audienceSummary: "Startup founders",
      studioObjective: "education",
      campaignName: null,
      complianceChecks: [],
    });

    const session = await contentIntelligenceGenerationService.generateBrief(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      { mode: "manual", objective: "education", studioType: "SOCIAL_POST" },
      contentTenantContext,
      "req-1",
    );

    expect(session.brief.keyMessage).toBe("SEIS delays are preventable");
    expect(aiRequestServiceMock.executeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaKey: "content.intelligence.brief",
        purpose: "CONTENT_DRAFT",
      }),
      contentTenantContext,
    );
  });

  it("rejects malformed AI brief output", async () => {
    aiRequestServiceMock.executeStructured.mockResolvedValue({
      aiRequestId: "ai-brief-bad",
      provider: "OPENAI",
      model: "gpt-test",
      output: { keyMessage: "" },
    });

    await expect(
      contentIntelligenceGenerationService.generateBrief(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        { mode: "manual", objective: "education", studioType: "SOCIAL_POST" },
        contentTenantContext,
      ),
    ).rejects.toThrow("We couldn't generate a valid content brief");
  });

  it("generates master content from persisted brief", async () => {
    const provenance = buildProvenanceMetadata({
      briefId: "content-1",
      creationMode: "manual",
      brandId: contentTestIds.brandId,
      structuredBrief: BASE_BRIEF,
    });
    prismaMock.contentProvenance.findFirst.mockResolvedValue({ id: "prov-1", metadata: provenance });
    prismaMock.contentItem.findFirstOrThrow.mockResolvedValue({
      id: "content-1",
      studioType: "SOCIAL_POST",
      status: "BRIEF",
    });
    prismaMock.contentItem.findFirst.mockResolvedValue({
      id: "content-1",
      status: "AI_GENERATED",
      version: 2,
      title: VALID_MASTER_OUTPUT.title,
      contentBody: VALID_MASTER_OUTPUT.body,
      primaryCTA: VALID_MASTER_OUTPUT.cta,
      contentPillar: null,
      audienceSummary: null,
      studioObjective: "education",
      campaignName: null,
      complianceChecks: [],
    });
    aiRequestServiceMock.executeStructured.mockResolvedValue({
      aiRequestId: "ai-master-1",
      provider: "OPENAI",
      model: "gpt-test",
      output: VALID_MASTER_OUTPUT,
    });

    const session = await contentIntelligenceGenerationService.generateMaster(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      { contentId: "content-1" },
      contentTenantContext,
      "req-2",
    );

    expect(session.master?.title).toBe(VALID_MASTER_OUTPUT.title);
    expect(contentStudioServiceMock.runCompliance).toHaveBeenCalled();
  });

  it("rejects cross-tenant audience references", async () => {
    mockBrandSnapshot();
    await expect(
      contentIntelligenceGenerationService.generateBrief(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        { mode: "manual", objective: "education", audienceId: "foreign-audience", studioType: "SOCIAL_POST" },
        contentTenantContext,
      ),
    ).rejects.toThrow("Audience was not found");
  });

  it("maps provider failures to controlled errors", async () => {
    aiRequestServiceMock.executeStructured.mockRejectedValue(
      new AppError("AI_CONFIGURATION_REQUIRED", "No provider"),
    );

    await expect(
      contentIntelligenceGenerationService.generateBrief(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        { mode: "manual", objective: "education", studioType: "SOCIAL_POST" },
        contentTenantContext,
      ),
    ).rejects.toThrow("AI content generation is not configured");
  });
});

describe("AI structured output validation", () => {
  it("accepts valid intelligence brief output", () => {
    const result = contentIntelligenceBriefOutputSchema.safeParse(VALID_BRIEF_OUTPUT);
    expect(result.success).toBe(true);
  });
});
