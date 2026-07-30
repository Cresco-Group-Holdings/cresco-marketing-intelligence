import type { EmailMessageCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { checkConsentEligibility } from "@/lib/email/consent";
import { getEmailProviderAdapter } from "@/lib/email/providers/registry";
import { canCancel, canDispatch, checkTenantQuota, nextStatusAfterDispatch } from "@/lib/email/send-pipeline";
import { normaliseEmailAddress, shouldBlockSend } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { recordAuditEvent } from "@/server/services/audit-service";

export const emailMessageService = {
  async listMessages(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailMessage.findMany({
      where: { organisationId, brandId },
      include: { senderIdentity: true, recipients: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async queueMessage(
    brandId: string,
    organisationId: string,
    input: {
      senderIdentityId: string;
      category: EmailMessageCategory;
      subject: string;
      preheader?: string;
      htmlBody?: string;
      plainTextBody?: string;
      templateId?: string;
      templateVersionId?: string;
      recipients: Array<{ emailAddress: string; displayName?: string; variables?: Record<string, string> }>;
      scheduledAt?: string;
      idempotencyKey?: string;
      consent?: { marketing: boolean; transactional: boolean };
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    if (input.idempotencyKey) {
      const existing = await prisma.emailMessage.findFirst({
        where: { organisationId, idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const sender = await prisma.emailSenderIdentity.findFirst({
      where: { id: input.senderIdentityId, organisationId, verificationStatus: "VERIFIED" },
      include: { domain: { include: { providerConnection: true } } },
    });
    if (!sender) throw new AppError("NOT_FOUND", "Verified sender identity not found.");
    if (!sender.allowedCategories.includes(input.category)) {
      throw new AppError("FORBIDDEN", "Sender is not authorised for this message category.");
    }
    if (sender.domain.sendingStatus !== "READY") {
      throw new AppError("VALIDATION_ERROR", "Sending domain is not ready.");
    }

    const consentCheck = checkConsentEligibility(input.category, input.consent ?? { marketing: false, transactional: true });
    if (!consentCheck.eligible) throw new AppError("VALIDATION_ERROR", consentCheck.reason ?? "Consent check failed.");

    const connection = sender.domain.providerConnection;
    const dailyQuota = connection.dailyQuota ?? 10_000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sentToday = await prisma.emailMessage.count({
      where: { organisationId, brandId, createdAt: { gte: todayStart }, status: { notIn: ["CANCELLED", "SUPPRESSED"] } },
    });
    const quota = checkTenantQuota(sentToday, dailyQuota);
    if (!quota.allowed) throw new AppError("VALIDATION_ERROR", quota.reason ?? "Quota exceeded.");

    const suppressedRecipients: string[] = [];
    const validRecipients: typeof input.recipients = [];

    for (const r of input.recipients) {
      const email = normaliseEmailAddress(r.emailAddress);
      const suppression = await prisma.emailSuppression.findUnique({
        where: { organisationId_emailAddress: { organisationId, emailAddress: email } },
      });
      const unsubscribe = await prisma.emailUnsubscribe.findFirst({
        where: { organisationId, emailAddress: email, OR: [{ category: input.category }, { category: null }] },
      });
      const block = shouldBlockSend(
        input.category,
        suppression ? { emailAddress: email, reason: suppression.reason, suppressed: true } : null,
        !!unsubscribe,
      );
      if (block.blocked) {
        suppressedRecipients.push(email);
      } else {
        validRecipients.push({ ...r, emailAddress: email });
      }
    }

    if (validRecipients.length === 0) {
      throw new AppError("VALIDATION_ERROR", "All recipients are suppressed.");
    }

    const status = input.scheduledAt ? "SCHEDULED" as const : "QUEUED" as const;

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.emailMessage.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          providerConnectionId: connection.id,
          senderIdentityId: sender.id,
          templateId: input.templateId,
          templateVersionId: input.templateVersionId,
          category: input.category,
          status,
          subject: input.subject,
          preheader: input.preheader,
          htmlBody: input.htmlBody,
          plainTextBody: input.plainTextBody,
          idempotencyKey: input.idempotencyKey,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          createdByUserId: context.userProfileId,
          recipients: {
            create: [
              ...validRecipients.map((r) => ({
                emailAddress: r.emailAddress,
                displayName: r.displayName,
                variables: r.variables as Prisma.InputJsonValue,
                status: "PENDING" as const,
              })),
              ...suppressedRecipients.map((email) => ({
                emailAddress: email,
                status: "SUPPRESSED" as const,
              })),
            ],
          },
        },
        include: { recipients: true },
      });

      await tx.emailDeliveryEvent.create({
        data: {
          messageId: created.id,
          eventType: "QUEUED",
          occurredAt: new Date(),
          metadata: { recipientCount: validRecipients.length, suppressedCount: suppressedRecipients.length },
        },
      });

      return created;
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "email.message.queue",
      resourceType: "EmailMessage",
      resourceId: message.id,
      metadata: { brandId, category: input.category },
    });

    return message;
  },

  async dispatchMessage(messageId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const message = await prisma.emailMessage.findFirst({
      where: { id: messageId, organisationId, brandId },
      include: {
        senderIdentity: { include: { domain: { include: { providerConnection: true } } } },
        recipients: { where: { status: "PENDING" } },
      },
    });
    if (!message) throw new AppError("NOT_FOUND", "Message not found.");

    if (!canDispatch({
      status: message.status,
      retryCount: message.retryCount,
      scheduledAt: message.scheduledAt,
      cancelledAt: message.cancelledAt,
    })) {
      throw new AppError("VALIDATION_ERROR", "Message cannot be dispatched in current state.");
    }

    const connection = message.senderIdentity.domain.providerConnection;
    const adapter = getEmailProviderAdapter(connection.providerType);

    await prisma.emailMessage.update({
      where: { id: messageId },
      data: { status: "SENDING" },
    });

    try {
      const result = await adapter.send({
        from: `${message.senderIdentity.displayName} <${message.senderIdentity.emailAddress}>`,
        replyTo: message.senderIdentity.replyTo ?? undefined,
        subject: message.subject,
        html: message.htmlBody ?? undefined,
        text: message.plainTextBody ?? undefined,
        recipients: message.recipients.map((r) => ({
          email: r.emailAddress,
          name: r.displayName ?? undefined,
          variables: (r.variables as Record<string, string>) ?? undefined,
        })),
        idempotencyKey: message.idempotencyKey ?? undefined,
      });

      const newStatus = nextStatusAfterDispatch(true, message.retryCount);
      return prisma.$transaction(async (tx) => {
        const updated = await tx.emailMessage.update({
          where: { id: messageId },
          data: {
            status: newStatus,
            providerMessageId: result.providerMessageId,
            sentAt: new Date(),
          },
        });
        for (const r of message.recipients) {
          await tx.emailMessageRecipient.update({
            where: { id: r.id },
            data: {
              status: "SENT",
              providerRecipientId: result.recipientIds[r.emailAddress],
            },
          });
        }
        await tx.emailDeliveryEvent.create({
          data: {
            messageId,
            eventType: "SENT",
            providerEventId: result.providerMessageId,
            occurredAt: new Date(),
          },
        });
        return updated;
      });
    } catch (err) {
      const newStatus = nextStatusAfterDispatch(false, message.retryCount);
      await prisma.emailMessage.update({
        where: { id: messageId },
        data: {
          status: newStatus,
          retryCount: message.retryCount + 1,
          failureReason: err instanceof Error ? err.message : "Send failed",
        },
      });
      throw new AppError("INTERNAL_ERROR", "Failed to dispatch message.");
    }
  },

  async cancelMessage(messageId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const message = await prisma.emailMessage.findFirst({
      where: { id: messageId, organisationId, brandId },
    });
    if (!message) throw new AppError("NOT_FOUND", "Message not found.");
    if (!canCancel({ status: message.status, retryCount: message.retryCount, scheduledAt: message.scheduledAt, cancelledAt: message.cancelledAt })) {
      throw new AppError("VALIDATION_ERROR", "Message cannot be cancelled.");
    }
    return prisma.emailMessage.update({
      where: { id: messageId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  },
};
