import type { Prisma } from "@prisma/client";
import { seoBriefOutputSchema } from "@/lib/ai/brief-output-schemas";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { assembleEvidenceLimitations, type BriefEvidenceBundle } from "@/lib/briefs/evidence-assembler";
import {
  competitorEvidenceDisclaimer,
  sanitiseCompetitorHeading,
  truncateCompetitorExcerpt,
  validateBriefDoesNotInstructPlagiarism,
} from "@/lib/briefs/competitor-guardrails";
import { recommendInternalLinks } from "@/lib/briefs/internal-links";
import { filterAllowedSchemaTypes, suggestSchemaTypes } from "@/lib/briefs/schema-suggestions";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { seoContentBriefService } from "@/server/services/seo-content-brief-service";
import { brandService } from "@/server/services/workspace-service";

export const seoBriefAiService = {
  async generateBrief(briefId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const brief = await seoContentBriefService.getById(briefId, brandId, organisationId, context);

    if (brief.status === "APPROVED") {
      throw new AppError("VALIDATION_ERROR", "Approved briefs cannot be regenerated without creating a new version.");
    }

    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const primaryKw = brief.primaryKeyword;
    const secondaryKws = brief.keywords.filter((k) => k.role === "SECONDARY");

    const gscMetrics = primaryKw
      ? await prisma.seoKeywordMetric.findMany({
          where: { keywordId: primaryKw.id, metricType: { in: ["IMPRESSIONS", "AVERAGE_POSITION"] } },
          orderBy: { measuredAt: "desc" },
          take: 4,
        })
      : [];

    const competitorPages = brief.clusterId
      ? await prisma.seoCompetitorPage.findMany({
          where: { competitor: { brandId }, detectedTopics: { isEmpty: false } },
          take: 5,
          orderBy: { observedAt: "desc" },
        })
      : [];

    const targetPage = brief.targetPageId
      ? await prisma.seoCrawlPage.findFirst({
          where: { id: brief.targetPageId },
          include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
        })
      : null;

    const relatedPages = await prisma.seoCrawlPage.findMany({
      where: { brandId, organisationId },
      include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: 30,
    });

    const pageNodes = relatedPages.map((p) => ({
      id: p.id,
      url: p.normalisedUrl,
      title: p.snapshots[0]?.title,
      topics: ((p.snapshots[0]?.headings as Array<{ level: number; text: string }> | null) ?? [])
        .filter((h) => h.level <= 2)
        .map((h) => h.text),
    }));

    const linkSuggestions = recommendInternalLinks({
      targetPage: targetPage
        ? { id: targetPage.id, url: targetPage.normalisedUrl, title: targetPage.snapshots[0]?.title ?? undefined }
        : undefined,
      relatedPages: pageNodes.map((p) => ({ ...p, title: p.title ?? undefined })),
      clusterTopics: brief.cluster ? [brief.cluster.name] : undefined,
      primaryKeyword: primaryKw?.displayKeyword,
    });

    const evidenceBundle: BriefEvidenceBundle = {
      keywords: [
        ...(primaryKw
          ? [{
              keyword: primaryKw.displayKeyword,
              intent: primaryKw.primaryIntent,
              impressions: gscMetrics.find((m) => m.metricType === "IMPRESSIONS")?.value,
              position: gscMetrics.find((m) => m.metricType === "AVERAGE_POSITION")?.value,
            }]
          : []),
        ...secondaryKws.map((k) => ({ keyword: k.keyword, intent: k.intent ?? "UNKNOWN" })),
      ],
      cluster: brief.cluster ? { id: brief.cluster.id, name: brief.cluster.name, memberCount: 0 } : undefined,
      targetPage: targetPage?.snapshots[0]
        ? { url: targetPage.snapshots[0].finalUrl, title: targetPage.snapshots[0].title ?? undefined, wordCount: targetPage.snapshots[0].wordCount ?? undefined }
        : undefined,
      searchConsole: {
        hasData: gscMetrics.length > 0,
        note: gscMetrics.length > 0 ? "GSC metrics from synced data" : "No GSC data available",
      },
      competitorEvidence: competitorPages.map((p) => ({
        url: p.url,
        type: "page_structure",
        excerpt: truncateCompetitorExcerpt(p.title ?? p.url),
        observedAt: p.observedAt.toISOString(),
      })),
      serpEvidence: [{
        query: primaryKw?.displayKeyword ?? "",
        hasCurrentData: false,
        note: "No licensed SERP observation on file",
      }],
      brandKnowledge: { hasSnapshot: !!snapshot },
      limitations: [],
    };

    const limitations = assembleEvidenceLimitations(evidenceBundle);
    limitations.push(competitorEvidenceDisclaimer());

    const schemaSuggestions = suggestSchemaTypes({
      contentType: brief.contentType ?? undefined,
      hasFaq: true,
      isHowTo: brief.contentType === "GUIDE",
    });

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "SEO_ANALYSIS",
        templateKey: "seo.briefs.generate",
        userInput: [
          "Generate a structured SEO content BRIEF only — do NOT write the full article.",
          `Primary keyword: ${primaryKw?.displayKeyword ?? "unspecified"}`,
          `Audience: ${brief.audience ?? "from brand context"}`,
          `CTA: ${brief.cta ?? "unspecified"}`,
          `Evidence bundle: ${JSON.stringify(evidenceBundle)}`,
          `Schema suggestions: ${JSON.stringify(schemaSuggestions)}`,
          "Do not reproduce competitor content. Do not instruct plagiarism.",
          `Limitations: ${limitations.join("; ")}`,
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "seo.briefs.generate",
      },
      context,
    );

    const parsed = seoBriefOutputSchema.parse(result.output);
    const plagiarismWarnings = validateBriefDoesNotInstructPlagiarism(parsed);
    if (plagiarismWarnings.length > 0) {
      parsed.complianceWarnings = [...(parsed.complianceWarnings ?? []), ...plagiarismWarnings];
    }

    // Sanitise competitor-related headings in output
    parsed.headings = parsed.headings.map((h) => ({
      ...h,
      text: sanitiseCompetitorHeading(h.text),
    }));

    parsed.schemaSuggestions = parsed.schemaSuggestions.filter((s) =>
      filterAllowedSchemaTypes([s.schemaType]).length > 0,
    );

    const lastVersion = brief.versions[0];
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await seoContentBriefService.persistGeneratedBrief(
      briefId,
      organisationId,
      brandId,
      versionNumber,
      parsed as unknown as Record<string, unknown>,
      {
        bundle: evidenceBundle as unknown as Record<string, unknown>,
        limitations,
        aiRequestId: result.requestId,
        aiModel: result.model,
        aiProvider: result.provider,
      },
      context,
    );

    // Persist competitor evidence
    await prisma.seoBriefCompetitorEvidence.deleteMany({ where: { briefId } });
    for (const ev of evidenceBundle.competitorEvidence) {
      await prisma.seoBriefCompetitorEvidence.create({
        data: {
          organisationId,
          briefId,
          competitorUrl: ev.url,
          evidenceType: ev.type,
          excerpt: ev.excerpt,
          coverageNote: "Public structure observation only",
          observedAt: ev.observedAt ? new Date(ev.observedAt) : undefined,
        },
      });
    }

    // Persist internal link suggestions
    await prisma.seoBriefInternalLink.deleteMany({ where: { briefId } });
    for (const link of linkSuggestions) {
      await prisma.seoBriefInternalLink.create({
        data: {
          organisationId,
          briefId,
          sourcePageId: link.sourcePageId,
          destinationPageId: link.destinationPageId,
          sourceUrl: link.sourceUrl,
          destinationUrl: link.destinationUrl,
          suggestedAnchorConcept: link.suggestedAnchorConcept,
          reason: link.reason,
          confidence: link.confidence,
        },
      });
    }

    // Add deterministic schema suggestions if AI missed them
    for (const s of schemaSuggestions) {
      const exists = parsed.schemaSuggestions.some((ps) => ps.schemaType === s.schemaType);
      if (!exists) {
        await prisma.seoBriefSchemaSuggestion.create({
          data: {
            organisationId,
            briefId,
            schemaType: s.schemaType,
            rationale: s.rationale,
            eligibilityNote: s.eligibilityNote,
          },
        });
      }
    }

    return { version, brief: await seoContentBriefService.getById(briefId, brandId, organisationId, context), limitations };
  },
};
