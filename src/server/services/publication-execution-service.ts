import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { operationToCapability } from "@/lib/publishing/outbound-operations";
import { assertPublicationTransition } from "@/lib/publishing/publication-lifecycle";
import type { TenantContext } from "@/lib/tenancy/context";
import { canonicalPublicationService } from "@/server/services/canonical-publication-service";
import { processPublicationPublishingJob } from "@/server/services/publication-publishing-worker";
import { providerGateway } from "@/server/services/provider-gateway-service";

function mapOperationToGatewayOperation(operationType: string): string {
  if (operationType.startsWith("SOCIAL_")) {
    if (operationType === "SOCIAL_CANCEL_SCHEDULED") return "cancelScheduledPost";
    if (operationType === "SOCIAL_GET_STATUS") return "getPublicationStatus";
    if (operationType === "SOCIAL_SCHEDULE_POST") return "schedulePost";
    return "publishPost";
  }
  if (operationType === "AD_CREATE_DRAFT_CAMPAIGN") return "createDraftCampaign";
  if (operationType === "AD_CREATE_AD_GROUP") return "createAdGroup";
  if (operationType === "AD_CREATE_AD_DRAFT") return "createAdDraft";
  if (operationType === "AD_UPLOAD_CREATIVE") return "uploadCreative";
  if (operationType === "AD_PAUSE") return "pauseCampaign";
  if (operationType === "AD_RESUME") return "resumeCampaign";
  if (operationType === "AD_UPDATE_BUDGET") return "updateBudget";
  if (operationType === "EMAIL_SCHEDULE") return "scheduleCampaign";
  if (operationType === "EMAIL_CANCEL") return "cancelCampaign";
  if (operationType === "EMAIL_GET_STATUS") return "getSendStatus";
  if (operationType === "CALENDAR_CREATE_EVENT") return "createEvent";
  if (operationType === "CALENDAR_UPDATE_EVENT") return "updateEvent";
  return "execute";
}

export const publicationExecutionService = {
  async validate(publicationId: string, organisationId: string, brandId: string, context: TenantContext) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    return publication.validationResult;
  },

  async execute(
    publicationId: string,
    organisationId: string,
    brandId: string,
    context: TenantContext,
    options?: { dryRun?: boolean; requestId?: string },
  ) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
      include: { budgetChanges: true, contentItem: { include: { variants: true } } },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");

    if (options?.dryRun) {
      const capability = operationToCapability(publication.operationType);
      const gatewayOperation = mapOperationToGatewayOperation(publication.operationType);
      const variant = publication.contentVariantId
        ? publication.contentItem.variants.find((v) => v.id === publication.contentVariantId)
        : publication.contentItem.variants[0];
      const result = await providerGateway.execute(
        {
          organisationId,
          connectionId: publication.connectionId,
          capability,
          operation: gatewayOperation,
          input: {
            ...(publication.providerPayload as Record<string, unknown> | null),
            externalAccountId: publication.externalAccountId,
            destinationId: publication.destinationId,
            caption: variant?.caption,
            dryRun: true,
          },
          idempotencyKey: publication.idempotencyKey,
          correlationId: options.requestId,
        },
        context,
      );
      return { success: result.success, data: result.data, dryRun: true };
    }

    const executableStatuses = new Set(["APPROVED", "SCHEDULED", "QUEUED"]);
    if (!executableStatuses.has(publication.status)) {
      throw new AppError("VALIDATION_ERROR", `Publication cannot be executed in status ${publication.status}.`);
    }

    if (publication.operationType === "AD_UPDATE_BUDGET" && publication.budgetChanges.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Budget change record is required.");
    }

    assertPublicationTransition(publication.status, "QUEUED");
    await prisma.publication.update({
      where: { id: publicationId },
      data: { status: "QUEUED" },
    });

    const idempotencyKey = `publication:${publicationId}:execute`;
    let job = await prisma.publishingJob.findFirst({
      where: { publicationId, idempotencyKey },
    });
    if (!job) {
      job = await prisma.publishingJob.create({
        data: {
          organisationId,
          projectId: publication.projectId,
          brandId,
          publicationId,
          idempotencyKey,
          status: "QUEUED",
        },
      });
    }

    const result = await processPublicationPublishingJob(job.id, context);
    return { success: result?.state === "PUBLISHED" || result?.state === "DUPLICATE", result };
  },

  async retry(publicationId: string, organisationId: string, brandId: string, context: TenantContext, requestId?: string) {
    const result = await canonicalPublicationService.retryPublication(
      brandId,
      organisationId,
      publicationId,
      context,
      requestId,
    );
    return { success: result.result?.state === "PUBLISHED", ...result };
  },

  async preview(publicationId: string, organisationId: string, brandId: string, context: TenantContext) {
    return this.execute(publicationId, organisationId, brandId, context, { dryRun: true });
  },
};
