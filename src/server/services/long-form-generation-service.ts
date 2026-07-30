import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import {
  classifyClaim,
  detectClaimsInText,
  flagUnsupportedClaims,
  validateCitationNotFabricated,
} from "@/lib/long-form/claim-detection";
import { runLongFormComplianceChecks } from "@/lib/long-form/compliance-rules";
import { mergeSectionWithLockedText } from "@/lib/long-form/locked-text";
import { buildSeoAssistanceReport } from "@/lib/long-form/seo-assistance";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { longFormDocumentService } from "@/server/services/long-form-document-service";
import { brandService } from "@/server/services/workspace-service";

type SectionAction =
  | "SECTION_GENERATE"
  | "SECTION_REGENERATE"
  | "SHORTEN"
  | "EXPAND"
  | "CHANGE_TONE"
  | "SIMPLIFY"
  | "ADD_EXAMPLES"
  | "REQUEST_EVIDENCE"
  | "FULL_DOCUMENT";

export const longFormGenerationService = {
  async generateOutline(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);

    if (doc.status !== "OUTLINE_PENDING" && doc.status !== "DRAFT") {
      throw new AppError("VALIDATION_ERROR", "Outline can only be generated when outline is pending.");
    }

    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "CONTENT_DRAFT",
        templateKey: "longForm.outline.generate",
        userInput: [
          `Approved brief: ${JSON.stringify(doc.brief)}`,
          `Brief version structured output: ${JSON.stringify(doc.briefVersion?.structuredOutput ?? {})}`,
          "Generate outline only — not full article body.",
          "Do not fabricate citations.",
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "longForm.outline.generate",
      },
      context,
    );

    const outline = result.output;

    await prisma.longFormContentVersion.updateMany({
      where: { documentId, organisationId },
      data: { outline: outline as Prisma.InputJsonValue },
    });

    if (outline.title) {
      await prisma.longFormContentDocument.update({
        where: { id: documentId },
        data: {
          title: outline.title,
          metaDescription: outline.metaDescription,
          slug: outline.slug,
        },
      });
    }

    await prisma.longFormGenerationRun.create({
      data: {
        organisationId,
        documentId,
        action: "OUTLINE",
        aiProvider: result.provider,
        aiModel: result.model,
        briefVersionId: doc.briefVersionId,
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
        estimatedCost: result.estimatedCostUsd,
        metadata: { outline } as Prisma.InputJsonValue,
      },
    });

    return { outline, document: await longFormDocumentService.getById(documentId, brandId, organisationId, context) };
  },

  async confirmOutline(
    documentId: string,
    brandId: string,
    organisationId: string,
    confirmed: boolean,
    context: TenantContext,
    changeNote?: string,
  ) {
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);
    if (doc.status !== "OUTLINE_PENDING") {
      throw new AppError("VALIDATION_ERROR", "Document must be awaiting outline confirmation.");
    }
    if (!confirmed) {
      return longFormDocumentService.transitionStatus(documentId, brandId, organisationId, "DRAFT", context, changeNote);
    }
    return longFormDocumentService.transitionStatus(
      documentId,
      brandId,
      organisationId,
      "OUTLINE_CONFIRMED",
      context,
      changeNote,
    );
  },

  async generateSection(
    documentId: string,
    sectionIndex: number,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    action: SectionAction = "SECTION_GENERATE",
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);

    if (action !== "FULL_DOCUMENT" && doc.status === "OUTLINE_PENDING") {
      throw new AppError("VALIDATION_ERROR", "Confirm outline before generating sections.");
    }

    const version = doc.versions[0];
    const outline = version?.outline as { sections?: Array<{ heading: string; summary: string; headingLevel?: number; blockType?: string }> } | null;
    const outlineSection = outline?.sections?.[sectionIndex];

    if (!outlineSection && action !== "FULL_DOCUMENT") {
      throw new AppError("VALIDATION_ERROR", "Section index not found in outline.");
    }

    const existingSection = doc.sections[sectionIndex];
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const actionInstruction = action === "SECTION_GENERATE"
      ? "Generate this section from scratch."
      : `Apply action: ${action}. Only modify this section.`;

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "CONTENT_DRAFT",
        templateKey: "longForm.section.generate",
        userInput: [
          actionInstruction,
          `Outline section: ${JSON.stringify(outlineSection)}`,
          `Existing section: ${existingSection ? JSON.stringify({ heading: existingSection.heading, body: existingSection.body, isLocked: existingSection.isLocked }) : "none"}`,
          existingSection?.isLocked ? "Preserve locked text ranges." : "",
          "Do not fabricate citations. Flag claims requiring evidence.",
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "longForm.section.generate",
      },
      context,
    );

    const generated = result.output;
    let body = generated.body;

    if (existingSection?.isLocked && existingSection.lockedRanges) {
      const ranges = existingSection.lockedRanges as Array<{ start: number; end: number }>;
      body = mergeSectionWithLockedText(existingSection.body, body, ranges);
    }

    const section = existingSection
      ? await prisma.longFormSection.update({
          where: { id: existingSection.id },
          data: {
            heading: generated.heading ?? outlineSection?.heading,
            headingLevel: generated.headingLevel ?? outlineSection?.headingLevel ?? 2,
            blockType: (generated.blockType as "PARAGRAPH") ?? "PARAGRAPH",
            body,
          },
        })
      : await prisma.longFormSection.create({
          data: {
            organisationId,
            documentId,
            versionId: version?.id,
            sortOrder: sectionIndex,
            heading: generated.heading ?? outlineSection?.heading,
            headingLevel: generated.headingLevel ?? outlineSection?.headingLevel ?? 2,
            blockType: (generated.blockType as "PARAGRAPH") ?? "PARAGRAPH",
            body,
          },
        });

    await this.syncClaimsAndCitations(documentId, section.id, organisationId, body, generated);

    await prisma.longFormGenerationRun.create({
      data: {
        organisationId,
        documentId,
        sectionId: section.id,
        action: action === "SECTION_GENERATE" ? "SECTION_GENERATE" : action,
        aiProvider: result.provider,
        aiModel: result.model,
        briefVersionId: doc.briefVersionId,
        generatedSectionIds: [section.id],
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
        estimatedCost: result.estimatedCostUsd,
      },
    });

    if (doc.status === "OUTLINE_CONFIRMED" || doc.status === "SECTIONS_GENERATING") {
      await prisma.longFormContentDocument.update({
        where: { id: documentId },
        data: { status: "SECTIONS_DRAFT" },
      });
    }

    return { section, document: await longFormDocumentService.getById(documentId, brandId, organisationId, context) };
  },

  async generateAllSections(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);
    const version = doc.versions[0];
    const outline = version?.outline as { sections?: unknown[] } | null;
    const count = outline?.sections?.length ?? doc.brief.headings.length;

    await prisma.longFormContentDocument.update({
      where: { id: documentId },
      data: { status: "SECTIONS_GENERATING" },
    });

    for (let i = 0; i < count; i++) {
      await this.generateSection(documentId, i, brandId, organisationId, context, "SECTION_GENERATE");
    }

    return longFormDocumentService.getById(documentId, brandId, organisationId, context);
  },

  async syncClaimsAndCitations(
    documentId: string,
    sectionId: string,
    organisationId: string,
    body: string,
    generated: { claims?: Array<{ claimText: string; classification: string; requiresCitation: boolean }>; citations?: Array<{ label: string; url?: string; sourceType?: string }> },
  ) {
    await prisma.longFormClaim.deleteMany({ where: { sectionId, organisationId } });

    const detected = flagUnsupportedClaims(detectClaimsInText(body));
    const aiClaims = generated.claims ?? [];

    const allClaims = [
      ...detected,
      ...aiClaims.map((c) => ({
        claimText: c.claimText,
        classification: classifyClaim(c.claimText).classification,
        isSupported: false,
        requiresCitation: c.requiresCitation,
        flagged: c.requiresCitation,
        flagReason: c.requiresCitation ? "AI flagged citation required." : undefined,
      })),
    ];

    for (const claim of allClaims) {
      await prisma.longFormClaim.create({
        data: {
          organisationId,
          documentId,
          sectionId,
          claimText: claim.claimText,
          classification: claim.classification,
          isSupported: claim.isSupported,
          requiresCitation: claim.requiresCitation,
          flagged: claim.flagged,
          flagReason: claim.flagReason,
        },
      });
    }

    if (generated.citations?.length) {
      for (const cit of generated.citations) {
        const validation = validateCitationNotFabricated({ url: cit.url, label: cit.label });
        await prisma.longFormCitation.create({
          data: {
            organisationId,
            documentId,
            sectionId,
            label: cit.label,
            url: cit.url,
            sourceType: cit.sourceType,
            isFabricated: validation.isFabricated,
            notes: validation.reason,
          },
        });
      }
    }
  },

  async buildSeoSnapshot(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);
    const unsupportedCount = doc.claims.filter((c) => c.flagged).length;

    const report = buildSeoAssistanceReport(
      {
        title: doc.title ?? undefined,
        metaDescription: doc.metaDescription ?? undefined,
        sections: doc.sections.map((s) => ({
          heading: s.heading,
          body: s.body,
          headingLevel: s.headingLevel,
        })),
        briefKeywords: doc.brief.keywords.map((k) => k.keyword),
        briefQuestions: doc.brief.questions.map((q) => q.question),
        briefHeadings: doc.brief.headings.map((h) => ({ level: h.level, text: h.text })),
      },
      unsupportedCount,
    );

    const version = doc.versions[0];
    if (version) {
      await prisma.longFormContentVersion.update({
        where: { id: version.id },
        data: { seoSnapshot: report as Prisma.InputJsonValue },
      });
    }

    return report;
  },

  async buildComplianceSnapshot(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const fullText = doc.sections.map((s) => s.body).join("\n");
    const findings = runLongFormComplianceChecks(fullText, {
      brandSlug: brand.slug,
      prohibitedClaims: brandContext.messaging?.prohibitedClaims,
      complianceRules: brandContext.compliance,
    });

    const version = doc.versions[0];
    if (version) {
      await prisma.longFormContentVersion.update({
        where: { id: version.id },
        data: { complianceSnapshot: { findings } as Prisma.InputJsonValue },
      });
    }

    return { findings };
  },
};
