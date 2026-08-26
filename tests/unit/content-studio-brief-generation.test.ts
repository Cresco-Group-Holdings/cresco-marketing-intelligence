import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { contentStudioBriefOutputSchema } from "@/lib/ai/brief-output-schemas";
import {
  buildStudioGenerationRequestId,
  getStudioGenerationState,
  mergeStudioGenerationState,
  parseProvenanceMetadata,
} from "@/lib/content-studio/generation-tracking";
import { contentStudioGenerateBriefSchema } from "@/lib/validation/content-studio";

describe("content studio generation tracking", () => {
  it("builds deterministic AI request ids for idempotency", () => {
    const requestId = buildStudioGenerationRequestId({
      organisationId: "org-1",
      brandId: "brand-1",
      contentItemId: "content-1",
      phase: "brief",
      idempotencyKey: "client-key-abc",
    });

    expect(requestId).toBe("studio:brief:org-1:brand-1:content-1:client-key-abc");
    expect(
      buildStudioGenerationRequestId({
        organisationId: "org-1",
        brandId: "brand-1",
        contentItemId: "content-1",
        phase: "brief",
        idempotencyKey: "client-key-abc",
      }),
    ).toBe(requestId);
  });

  it("stores generation state on provenance metadata without schema changes", () => {
    const metadata = mergeStudioGenerationState(null, "brief", {
      phase: "brief",
      idempotencyKey: "key-1",
      status: "completed",
      aiRequestId: "ai-req-1",
      versionNumber: 2,
    }) as Prisma.JsonValue;

    expect(getStudioGenerationState(metadata, "brief")?.status).toBe("completed");
    expect(parseProvenanceMetadata(metadata).studioGenerations?.brief?.aiRequestId).toBe("ai-req-1");
  });
});

describe("content studio brief schema", () => {
  it("validates structured brief output", () => {
    const parsed = contentStudioBriefOutputSchema.parse({
      title: "Q3 product launch",
      studioObjective: "Announce the new feature to existing customers",
      audienceSummary: "B2B marketing leaders evaluating automation tools",
      keyMessages: ["Faster workflows", "No extra headcount"],
      talkingPoints: ["Customer proof point from case study"],
      toneGuidance: "Confident and practical",
      primaryCTA: "Book a demo",
      channelRecommendations: [{ channel: "LinkedIn", rationale: "Primary B2B audience" }],
      contentAngle: "Outcome-first launch narrative",
      successMetrics: ["Profile visits", "Demo requests"],
      complianceNotes: ["Avoid performance guarantees"],
      limitations: "No customer quotes supplied in brand knowledge",
    });

    expect(parsed.title).toBe("Q3 product launch");
  });

  it("requires idempotency keys for generate-brief requests", () => {
    expect(() =>
      contentStudioGenerateBriefSchema.parse({
        studioType: "SOCIAL_POST",
      }),
    ).toThrow();
  });
});
