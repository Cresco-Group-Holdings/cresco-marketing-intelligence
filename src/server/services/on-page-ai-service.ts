import type { Prisma } from "@prisma/client";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { prisma } from "@/lib/database/prisma";
import { RANKING_DISCLAIMER } from "@/lib/on-page/constants";
import type { PageAuditInput } from "@/lib/on-page/technical-checks";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { onPageAuditService } from "@/server/services/on-page-audit-service";
import { brandService } from "@/server/services/workspace-service";

export const onPageAiService = {
  async runSemanticReview(
    auditId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    input: { pageInput: PageAuditInput; bodyText: string; evidenceBundle: Record<string, unknown> },
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const audit = await onPageAuditService.getById(auditId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "SEO_ANALYSIS",
        templateKey: "onPage.semantic.review",
        userInput: [
          `Page: ${JSON.stringify(input.pageInput)}`,
          `Target keyword: ${audit.targetKeyword?.displayKeyword ?? "none"}`,
          `Brief questions: ${JSON.stringify(audit.brief?.questions ?? [])}`,
          `Body excerpt: ${input.bodyText.slice(0, 4000)}`,
          "Every finding MUST include evidence references. Do not fabricate statistics.",
          RANKING_DISCLAIMER,
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "onPage.semantic.review",
      },
      context,
    );

    const review = result.output;
    const version = audit.versions[0];

    for (const finding of review.findings) {
      const record = await prisma.onPageSeoFinding.create({
        data: {
          organisationId,
          auditId,
          versionId: version?.id,
          category: finding.category as "SEMANTIC",
          title: finding.title,
          description: finding.description,
          evidence: finding.evidence as Prisma.InputJsonValue,
          priority: finding.priority,
        },
      });

      if (finding.recommendationType) {
        await prisma.onPageSeoRecommendation.create({
          data: {
            organisationId,
            auditId,
            findingId: record.id,
            type: finding.recommendationType as "CLARIFY_CONTENT",
            priority: finding.priority,
            title: finding.title,
            description: finding.description,
            evidence: finding.evidence as Prisma.InputJsonValue,
          },
        });
      }
    }

    return review;
  },
};
