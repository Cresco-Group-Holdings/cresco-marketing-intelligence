import { prisma } from "@/lib/database/prisma";
import type { EmailDeliveryEventType } from "@prisma/client";
import {
  mapNormalizedEventToEmailStatus,
  shouldAdvanceEmailStatus,
  type NormalizedProviderEmailEvent,
  type NormalizedProviderEmailEventType,
} from "@/server/providers/resend/resend-normalizer";
import { providerAuditService } from "@/server/services/provider-audit-service";

function toDeliveryEventType(eventType: NormalizedProviderEmailEventType): EmailDeliveryEventType {
  const mapped = mapNormalizedEventToEmailStatus(eventType);
  const allowed: EmailDeliveryEventType[] = [
    "SENT",
    "DELIVERED",
    "DEFERRED",
    "BOUNCED",
    "COMPLAINED",
    "OPENED",
    "CLICKED",
    "FAILED",
    "REJECTED",
    "QUEUED",
    "ACCEPTED",
  ];
  return allowed.includes(mapped as EmailDeliveryEventType) ? (mapped as EmailDeliveryEventType) : "FAILED";
}

export const resendWebhookProcessorService = {
  async processNormalizedEvent(input: {
    organisationId: string;
    connectionId: string;
    event: NormalizedProviderEmailEvent;
    webhookEventId: string;
  }) {
    const { event } = input;

    if (event.providerMessageId) {
      const outbound = await prisma.providerOutboundSend.findFirst({
        where: {
          organisationId: input.organisationId,
          connectionId: input.connectionId,
          providerMessageId: event.providerMessageId,
        },
      });

      if (outbound) {
        const incomingStatus = mapNormalizedEventToEmailStatus(event.eventType);
        const currentStatus = outbound.status;
        if (shouldAdvanceEmailStatus(currentStatus, incomingStatus)) {
          await prisma.providerOutboundSend.update({
            where: { id: outbound.id },
            data: {
              metadata: {
                lastEventType: event.eventType,
                lastEventAt: event.occurredAt,
              },
            },
          });
        }
      }

      const emailMessage = await prisma.emailMessage.findFirst({
        where: {
          organisationId: input.organisationId,
          providerMessageId: event.providerMessageId,
        },
        include: { recipients: true },
      });

      if (emailMessage) {
        const incomingStatus = mapNormalizedEventToEmailStatus(event.eventType);
        if (shouldAdvanceEmailStatus(emailMessage.status, incomingStatus)) {
          await prisma.emailMessage.update({
            where: { id: emailMessage.id },
            data: { status: incomingStatus as never },
          });
        }

        await prisma.emailDeliveryEvent.create({
          data: {
            messageId: emailMessage.id,
            eventType: toDeliveryEventType(event.eventType),
            occurredAt: new Date(event.occurredAt),
            providerEventId: event.providerEventId,
            metadata: event.safeMetadata as object,
          },
        });
      }
    }

    if (event.recipient) {
      if (event.eventType === "EMAIL_BOUNCED") {
        const bounceType = event.safeMetadata.bounceType;
        if (bounceType === "Permanent" || bounceType === "permanent") {
          await this.suppressRecipient(input.organisationId, event.recipient, "HARD_BOUNCE", input.connectionId);
        }
      }
      if (event.eventType === "EMAIL_COMPLAINED") {
        await this.suppressRecipient(input.organisationId, event.recipient, "COMPLAINT", input.connectionId);
      }
      if (event.eventType === "EMAIL_SUPPRESSED") {
        await this.suppressRecipient(input.organisationId, event.recipient, "PROVIDER_SUPPRESSION", input.connectionId);
      }
    }

    await prisma.providerWebhookEvent.update({
      where: { id: input.webhookEventId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  },

  async suppressRecipient(
    organisationId: string,
    emailAddress: string,
    reason: string,
    connectionId: string,
  ) {
    await prisma.emailSuppression.upsert({
      where: { organisationId_emailAddress: { organisationId, emailAddress: emailAddress.toLowerCase() } },
      create: {
        organisationId,
        emailAddress: emailAddress.toLowerCase(),
        reason: reason as never,
        source: "PROVIDER_WEBHOOK",
      },
      update: {
        reason: reason as never,
        source: "PROVIDER_WEBHOOK",
      },
    });

    await providerAuditService.recordEvent({
      organisationId,
      providerKey: "resend",
      action: "SUPPRESSION_APPLIED",
      connectionId,
      result: "success",
      metadata: { reason },
    });
  },
};
