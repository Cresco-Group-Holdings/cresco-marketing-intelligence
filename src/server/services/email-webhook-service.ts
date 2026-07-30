import type { EmailBounceType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { shouldShutdownSending, detectDeliverabilityWarnings, computeRates } from "@/lib/email/deliverability";
import { getEmailProviderAdapter } from "@/lib/email/providers/registry";
import { normaliseEventType, buildWebhookIdempotencyKey, isReplay } from "@/lib/email/webhooks";
import { normaliseEmailAddress } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const emailWebhookService = {
  async processWebhook(
    providerConnectionId: string,
    organisationId: string,
    payload: string,
    signature: string,
    secret: string,
  ) {
    const connection = await prisma.emailProviderConnection.findFirst({
      where: { id: providerConnectionId, organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    const webhook = await prisma.emailProviderWebhook.findFirst({
      where: { providerConnectionId, isActive: true },
    });
    if (webhook?.lastReceivedAt && isReplay(new Date(), webhook.lastReceivedAt)) {
      throw new AppError("VALIDATION_ERROR", "Replay detected.");
    }

    const adapter = getEmailProviderAdapter(connection.providerType);
    if (!adapter.verifyWebhookSignature(payload, signature, secret)) {
      throw new AppError("FORBIDDEN", "Invalid webhook signature.");
    }

    const events = adapter.parseWebhookEvents(JSON.parse(payload));
    const processed = [];

    for (const event of events) {
      const eventType = normaliseEventType(event.eventType);
      const idempotencyKey = buildWebhookIdempotencyKey(
        event.providerEventId,
        eventType,
        event.emailAddress,
        event.occurredAt,
      );

      const existing = await prisma.emailDeliveryEvent.findFirst({
        where: { OR: [{ providerEventId: event.providerEventId }, { idempotencyKey }] },
      });
      if (existing) continue;

      let message = event.providerMessageId
        ? await prisma.emailMessage.findFirst({ where: { providerMessageId: event.providerMessageId, organisationId } })
        : null;

      const deliveryEvent = await prisma.emailDeliveryEvent.create({
        data: {
          messageId: message?.id ?? (await this.findOrCreatePlaceholderMessage(organisationId, event.providerMessageId)),
          eventType,
          providerEventId: event.providerEventId,
          occurredAt: event.occurredAt,
          idempotencyKey,
          metadata: event.metadata as object,
        },
      });

      if (eventType === "BOUNCED" && event.emailAddress) {
        await this.processBounce(organisationId, event.emailAddress, event.bounceType ?? "HARD", event.reason, message?.id);
      }
      if (eventType === "COMPLAINED" && event.emailAddress) {
        await this.processComplaint(organisationId, event.emailAddress, event.reason, message?.id);
      }
      if (eventType === "UNSUBSCRIBED" && event.emailAddress) {
        await prisma.emailSuppression.upsert({
          where: { organisationId_emailAddress: { organisationId, emailAddress: normaliseEmailAddress(event.emailAddress) } },
          create: { organisationId, emailAddress: normaliseEmailAddress(event.emailAddress), reason: "UNSUBSCRIBE", source: "WEBHOOK" },
          update: { reason: "UNSUBSCRIBE", suppressedAt: new Date() },
        });
      }

      processed.push(deliveryEvent);
    }

    if (webhook) {
      await prisma.emailProviderWebhook.update({
        where: { id: webhook.id },
        data: { lastReceivedAt: new Date() },
      });
    }

    return { processed: processed.length };
  },

  async findOrCreatePlaceholderMessage(organisationId: string, providerMessageId?: string): Promise<string> {
    if (providerMessageId) {
      const msg = await prisma.emailMessage.findFirst({ where: { providerMessageId, organisationId } });
      if (msg) return msg.id;
    }
    const brand = await prisma.brand.findFirst({ where: { organisationId } });
    if (!brand) throw new AppError("NOT_FOUND", "No brand for webhook message.");
    const sender = await prisma.emailSenderIdentity.findFirst({ where: { organisationId } });
    if (!sender) throw new AppError("NOT_FOUND", "No sender for webhook message.");
    const msg = await prisma.emailMessage.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId: brand.id,
        senderIdentityId: sender.id,
        category: "OTHER",
        status: "SENT",
        subject: "[Webhook orphan]",
        providerMessageId,
        createdByUserId: sender.id,
      },
    });
    return msg.id;
  },

  async processBounce(organisationId: string, emailAddress: string, bounceType: EmailBounceType, reason?: string, messageId?: string) {
    const email = normaliseEmailAddress(emailAddress);
    await prisma.emailBounce.create({
      data: { organisationId, messageId, emailAddress: email, bounceType, reason },
    });
    if (bounceType === "HARD") {
      await prisma.emailSuppression.upsert({
        where: { organisationId_emailAddress: { organisationId, emailAddress: email } },
        create: { organisationId, emailAddress: email, reason: "HARD_BOUNCE", source: "WEBHOOK" },
        update: { reason: "HARD_BOUNCE", suppressedAt: new Date() },
      });
    }
  },

  async processComplaint(organisationId: string, emailAddress: string, reason?: string, messageId?: string) {
    const email = normaliseEmailAddress(emailAddress);
    await prisma.emailComplaint.create({
      data: { organisationId, messageId, emailAddress: email, reason },
    });
    await prisma.emailSuppression.upsert({
      where: { organisationId_emailAddress: { organisationId, emailAddress: email } },
      create: { organisationId, emailAddress: email, reason: "COMPLAINT", source: "WEBHOOK" },
      update: { reason: "COMPLAINT", suppressedAt: new Date() },
    });
  },
};

export const emailDeliverabilityService = {
  async getSnapshot(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 30 * 86_400_000);

    const [sentCount, deliveredCount, bounceCount, hardBounceCount, complaintCount, unsubscribeCount, rejectionCount] =
      await Promise.all([
        prisma.emailMessage.count({ where: { organisationId, brandId, createdAt: { gte: periodStart }, status: { notIn: ["CANCELLED"] } } }),
        prisma.emailDeliveryEvent.count({ where: { message: { organisationId, brandId }, eventType: "DELIVERED", occurredAt: { gte: periodStart } } }),
        prisma.emailBounce.count({ where: { organisationId, occurredAt: { gte: periodStart } } }),
        prisma.emailBounce.count({ where: { organisationId, bounceType: "HARD", occurredAt: { gte: periodStart } } }),
        prisma.emailComplaint.count({ where: { organisationId, occurredAt: { gte: periodStart } } }),
        prisma.emailUnsubscribe.count({ where: { organisationId, brandId, unsubscribedAt: { gte: periodStart } } }),
        prisma.emailDeliveryEvent.count({ where: { message: { organisationId, brandId }, eventType: "REJECTED", occurredAt: { gte: periodStart } } }),
      ]);

    const metrics = { sentCount, deliveredCount, bounceCount, hardBounceCount, complaintCount, unsubscribeCount, rejectionCount };
    const rates = computeRates(metrics);
    const warnings = detectDeliverabilityWarnings(metrics);

    const snapshot = await prisma.emailDeliverabilitySnapshot.create({
      data: {
        organisationId,
        brandId,
        periodStart,
        periodEnd,
        ...metrics,
        deliveryRate: rates.deliveryRate,
        bounceRate: rates.bounceRate,
        complaintRate: rates.complaintRate,
        warnings: warnings as object,
      },
    });

    return { snapshot, warnings, shutdownRecommended: shouldShutdownSending(warnings) };
  },

  async listSnapshots(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailDeliverabilitySnapshot.findMany({
      where: { organisationId, brandId },
      orderBy: { computedAt: "desc" },
      take: 30,
    });
  },
};
