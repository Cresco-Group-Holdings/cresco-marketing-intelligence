import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { STALE_SNAPSHOT_DAYS, TECHNICAL_RULE_TO_RECOMMENDATION } from "@/lib/on-page/constants";
import { runKeywordReview } from "@/lib/on-page/keyword-review";
import { buildReadabilityReport } from "@/lib/on-page/readability";
import { isSnapshotStale, runTechnicalChecks, type PageAuditInput } from "@/lib/on-page/technical-checks";
import type { TenantContext } from "@/lib/tenancy/context";
import { onPageAuditService } from "@/server/services/on-page-audit-service";
import { onPageAiService } from "@/server/services/on-page-ai-service";

function snapshotToInput(
  snapshot: {
    finalUrl: string;
    statusCode: number;
    title?: string | null;
    description?: string | null;
    canonicalUrl?: string | null;
    robotsDirective?: string | null;
    wordCount?: number | null;
    headings?: unknown;
    extractedAt: Date;
    contentHash?: string | null;
  },
  extras?: Partial<PageAuditInput>,
): PageAuditInput {
  return {
    url: snapshot.finalUrl,
    finalUrl: snapshot.finalUrl,
    statusCode: snapshot.statusCode,
    title: snapshot.title,
    description: snapshot.description,
    canonicalUrl: snapshot.canonicalUrl,
    robotsDirective: snapshot.robotsDirective,
    wordCount: snapshot.wordCount,
    headings: snapshot.headings as Array<{ level: number; text: string }> | null,
    isHttps: snapshot.finalUrl.startsWith("https://"),
    snapshotAge: snapshot.extractedAt,
    contentHash: snapshot.contentHash,
    ...extras,
  };
}

export const onPageCheckService = {
  async runAudit(auditId: string, brandId: string, organisationId: string, context: TenantContext) {
    const audit = await onPageAuditService.getById(auditId, brandId, organisationId, context);

    await prisma.onPageSeoAudit.update({
      where: { id: auditId },
      data: { status: "RUNNING" },
    });

    try {
      let pageInput: PageAuditInput;
      let bodyText = "";
      const evidenceBundle: Record<string, unknown> = {};

      if (audit.pageSnapshot) {
        pageInput = snapshotToInput(audit.pageSnapshot);
        evidenceBundle.crawlSnapshot = { id: audit.pageSnapshot.id, extractedAt: audit.pageSnapshot.extractedAt };
      } else if (audit.crawlPage) {
        const snapshot = await prisma.seoPageSnapshot.findFirst({
          where: { pageId: audit.crawlPage.id },
          orderBy: { createdAt: "desc" },
        });
        if (!snapshot) throw new Error("No snapshot available for crawl page.");
        pageInput = snapshotToInput(snapshot);
        evidenceBundle.crawlSnapshot = { id: snapshot.id, extractedAt: snapshot.extractedAt };
      } else if (audit.longFormDocument) {
        const sections = audit.longFormDocument.sections;
        bodyText = sections.map((s) => `${s.heading ?? ""}\n${s.body}`).join("\n\n");
        const headings = sections
          .filter((s) => s.heading)
          .map((s) => ({ level: s.headingLevel, text: s.heading! }));
        pageInput = {
          url: audit.url ?? "draft://long-form",
          title: audit.longFormDocument.title,
          description: audit.longFormDocument.metaDescription,
          headings,
          wordCount: bodyText.split(/\s+/).filter(Boolean).length,
          emptySections: sections.filter((s) => !s.body.trim()).map((s) => s.heading ?? "untitled"),
        };
        evidenceBundle.longFormDocument = { id: audit.longFormDocument.id };
      } else {
        pageInput = { url: audit.url ?? "unknown" };
      }

      if (audit.brief) {
        evidenceBundle.brief = { id: audit.brief.id, status: audit.brief.status };
      }

      const stale = isSnapshotStale(pageInput.snapshotAge, STALE_SNAPSHOT_DAYS);
      if (stale) {
        await prisma.onPageSeoAudit.update({
          where: { id: auditId },
          data: {
            staleSnapshotWarning: true,
            staleSnapshotNote: `Snapshot is older than ${STALE_SNAPSHOT_DAYS} days. Re-crawl recommended.`,
          },
        });
      }

      const technicalFindings = runTechnicalChecks(pageInput);
      const keywordFindings = runKeywordReview({
        targetKeyword: audit.targetKeyword?.displayKeyword,
        title: pageInput.title,
        description: pageInput.description,
        headings: pageInput.headings ?? undefined,
        bodyText: bodyText || undefined,
      });

      if (!bodyText && pageInput.wordCount) {
        bodyText = "x".repeat(pageInput.wordCount);
      }
      const readability = buildReadabilityReport({
        bodyText: bodyText || (pageInput.title ?? "") + " " + (pageInput.description ?? ""),
        headings: pageInput.headings ?? undefined,
      });

      const latestVersion = audit.versions[0];
      const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      const version = await prisma.onPageSeoAuditVersion.create({
        data: {
          organisationId,
          auditId,
          versionNumber,
          status: "COMPLETED",
          inputSnapshot: pageInput as unknown as Prisma.InputJsonValue,
          technicalSummary: { count: technicalFindings.length } as Prisma.InputJsonValue,
          keywordSummary: { count: keywordFindings.length } as Prisma.InputJsonValue,
          readabilitySnapshot: readability as unknown as Prisma.InputJsonValue,
          evidenceBundle: evidenceBundle as Prisma.InputJsonValue,
        },
      });

      for (const tf of technicalFindings) {
        const finding = await prisma.onPageSeoFinding.create({
          data: {
            organisationId,
            auditId,
            versionId: version.id,
            category: tf.category,
            ruleId: tf.ruleId,
            title: tf.title,
            description: tf.description,
            evidence: tf.evidence as Prisma.InputJsonValue,
            priority: tf.priority,
          },
        });

        const recType = TECHNICAL_RULE_TO_RECOMMENDATION[tf.ruleId] ?? "FIX_TECHNICAL";
        await prisma.onPageSeoRecommendation.create({
          data: {
            organisationId,
            auditId,
            findingId: finding.id,
            type: recType as "FIX_TECHNICAL",
            priority: tf.priority,
            title: tf.title,
            description: tf.description,
            evidence: tf.evidence as Prisma.InputJsonValue,
          },
        });
      }

      for (const kf of keywordFindings) {
        const finding = await prisma.onPageSeoFinding.create({
          data: {
            organisationId,
            auditId,
            versionId: version.id,
            category: "KEYWORD",
            ruleId: kf.ruleId,
            title: kf.title,
            description: kf.description,
            evidence: kf.evidence as Prisma.InputJsonValue,
            priority: kf.priority,
          },
        });
        await prisma.onPageSeoRecommendation.create({
          data: {
            organisationId,
            auditId,
            findingId: finding.id,
            type: kf.ruleId.includes("STUFFING") ? "CLARIFY_CONTENT" : "IMPROVE_TITLE",
            priority: kf.priority,
            title: kf.title,
            description: kf.description,
            evidence: kf.evidence as Prisma.InputJsonValue,
          },
        });
      }

      for (const indicator of readability.indicators) {
        await prisma.onPageSeoFinding.create({
          data: {
            organisationId,
            auditId,
            versionId: version.id,
            category: "READABILITY",
            ruleId: "READABILITY_INDICATOR",
            title: "Readability indicator",
            description: indicator,
            evidence: readability.evidence as Prisma.InputJsonValue,
            priority: "LOW",
          },
        });
      }

      let semanticSummary: unknown = null;
      try {
        semanticSummary = await onPageAiService.runSemanticReview(auditId, brandId, organisationId, context, {
          pageInput,
          bodyText,
          evidenceBundle,
        });
      } catch {
        semanticSummary = { skipped: true, reason: "AI semantic review unavailable" };
      }

      await prisma.onPageSeoAuditVersion.update({
        where: { id: version.id },
        data: { semanticSummary: semanticSummary as Prisma.InputJsonValue },
      });

      await prisma.onPageSeoAudit.update({
        where: { id: auditId },
        data: { status: "COMPLETED", currentVersionId: version.id },
      });

      return onPageAuditService.getById(auditId, brandId, organisationId, context);
    } catch (err) {
      await prisma.onPageSeoAudit.update({
        where: { id: auditId },
        data: { status: "FAILED" },
      });
      throw err;
    }
  },
};
