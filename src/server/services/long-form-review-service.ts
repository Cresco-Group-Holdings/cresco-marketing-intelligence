import type { LongFormDocumentStatus, LongFormReviewStage } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { REVIEW_STAGE_ORDER } from "@/lib/long-form/constants";
import { hasBlockingComplianceFindings } from "@/lib/long-form/compliance-rules";
import type { TenantContext } from "@/lib/tenancy/context";
import { longFormDocumentService } from "@/server/services/long-form-document-service";
import { longFormGenerationService } from "@/server/services/long-form-generation-service";
import { brandService } from "@/server/services/workspace-service";

const STAGE_STATUS_MAP: Record<LongFormReviewStage, LongFormDocumentStatus> = {
  OUTLINE: "OUTLINE_CONFIRMED",
  EVIDENCE: "EVIDENCE_REVIEW",
  SEO: "SEO_REVIEW",
  COMPLIANCE: "COMPLIANCE_REVIEW",
  FINAL: "PENDING_APPROVAL",
};

const NEXT_STAGE: Partial<Record<LongFormReviewStage, LongFormReviewStage>> = {
  OUTLINE: "EVIDENCE",
  EVIDENCE: "SEO",
  SEO: "COMPLIANCE",
  COMPLIANCE: "FINAL",
};

export const longFormReviewService = {
  async submitStage(
    documentId: string,
    brandId: string,
    organisationId: string,
    stage: LongFormReviewStage,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);

    if (stage === "EVIDENCE") {
      await longFormGenerationService.buildSeoSnapshot(documentId, brandId, organisationId, context);
    }
    if (stage === "COMPLIANCE") {
      const { findings } = await longFormGenerationService.buildComplianceSnapshot(
        documentId,
        brandId,
        organisationId,
        context,
      );
      if (hasBlockingComplianceFindings(findings)) {
        throw new AppError("VALIDATION_ERROR", "Blocking compliance findings must be resolved before review.");
      }
    }

    const targetStatus = STAGE_STATUS_MAP[stage];
    await longFormDocumentService.transitionStatus(documentId, brandId, organisationId, targetStatus, context);

    await prisma.longFormReview.create({
      data: {
        organisationId,
        documentId,
        versionId: doc.currentVersionId,
        stage,
        requestedByUserId: context.userProfileId,
        decision: "PENDING",
      },
    });

    return longFormDocumentService.getById(documentId, brandId, organisationId, context);
  },

  async decide(
    documentId: string,
    brandId: string,
    organisationId: string,
    input: {
      stage: LongFormReviewStage;
      decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
      decisionNote?: string;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);

    const pending = await prisma.longFormReview.findFirst({
      where: { documentId, organisationId, stage: input.stage, decision: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (pending) {
      await prisma.longFormReview.update({
        where: { id: pending.id },
        data: {
          decision: input.decision,
          reviewerUserId: context.userProfileId,
          decisionNote: input.decisionNote,
          decidedAt: new Date(),
        },
      });
    }

    if (input.decision === "CHANGES_REQUESTED" || input.decision === "REJECTED") {
      return longFormDocumentService.transitionStatus(
        documentId,
        brandId,
        organisationId,
        "SECTIONS_DRAFT",
        context,
        input.decisionNote,
      );
    }

    if (input.stage === "FINAL") {
      await longFormDocumentService.transitionStatus(documentId, brandId, organisationId, "APPROVED", context);
      return longFormDocumentService.transitionStatus(documentId, brandId, organisationId, "PUBLISH_READY", context);
    }

    const nextStage = NEXT_STAGE[input.stage];
    if (nextStage) {
      const idx = REVIEW_STAGE_ORDER.indexOf(nextStage);
      const nextStatus = Object.values(STAGE_STATUS_MAP)[idx] ?? "SECTIONS_DRAFT";
      await longFormDocumentService.transitionStatus(documentId, brandId, organisationId, nextStatus, context);
    }

    return longFormDocumentService.getById(documentId, brandId, organisationId, context);
  },

  async getReviewSummary(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const doc = await longFormDocumentService.getById(documentId, brandId, organisationId, context);
    const seoReport = await longFormGenerationService.buildSeoSnapshot(documentId, brandId, organisationId, context);
    const compliance = await longFormGenerationService.buildComplianceSnapshot(
      documentId,
      brandId,
      organisationId,
      context,
    );

    return {
      document: doc,
      seoReport,
      compliance,
      unsupportedClaims: doc.claims.filter((c) => c.flagged),
      reviews: doc.reviews,
    };
  },
};
