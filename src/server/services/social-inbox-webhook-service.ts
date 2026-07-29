import { createHash } from "node:crypto";
import type { SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { digestPayload, validateHmacSha256Signature } from "@/lib/inbox/webhook";
import type { InboxAccountScope, IngestBatch } from "@/lib/inbox/types";
import { socialInboxIngestService } from "@/server/services/social-inbox-ingest-service";

export const socialInboxWebhookService = {
  async ingestEvent(input: {
    socialAccountId: string;
    organisationId: string;
    brandId: string;
    provider: SocialProvider;
    idempotencyKey: string;
    payload: string;
    signatureHeader?: string | null;
    secret?: string | null;
    toBatch: (payload: string) => Omit<IngestBatch, "idempotencyKey">;
  }) {
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: input.socialAccountId,
        organisationId: input.organisationId,
        brandId: input.brandId,
        provider: input.provider,
        status: "CONNECTED",
      },
    });
    if (!account) {
      throw new AppError("NOT_FOUND", "Social account was not found.");
    }

    const subscription = await prisma.socialInboxWebhookSubscription.findUnique({
      where: { socialAccountId: input.socialAccountId },
    });
    if (!subscription || subscription.status !== "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "Webhook subscription is not active.");
    }

    const secret = input.secret;
    if (secret && input.signatureHeader) {
      const valid = validateHmacSha256Signature({
        payload: input.payload,
        signatureHeader: input.signatureHeader,
        secret,
      });
      if (!valid) {
        throw new AppError("FORBIDDEN", "Webhook signature validation failed.");
      }
    } else if (subscription.secretDigest) {
      const payloadDigest = digestPayload(input.payload);
      if (payloadDigest !== subscription.secretDigest && input.signatureHeader !== subscription.secretDigest) {
        throw new AppError("FORBIDDEN", "Webhook signature validation failed.");
      }
    }

    const existing = await prisma.socialInboxWebhookEvent.findUnique({
      where: {
        socialAccountId_idempotencyKey: {
          socialAccountId: input.socialAccountId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing?.status === "PROCESSED") {
      return { event: existing, duplicate: true, ingest: null };
    }

    const event =
      existing ??
      (await prisma.socialInboxWebhookEvent.create({
        data: {
          organisationId: input.organisationId,
          brandId: input.brandId,
          socialAccountId: input.socialAccountId,
          provider: input.provider,
          idempotencyKey: input.idempotencyKey,
          payloadDigest: digestPayload(input.payload),
          status: "PENDING",
        },
      }));

    const scope: InboxAccountScope = {
      organisationId: account.organisationId,
      projectId: account.projectId,
      brandId: account.brandId,
      socialAccountId: account.id,
      provider: account.provider,
    };

    const ingest = await socialInboxIngestService.ingestBatch(scope, {
      idempotencyKey: input.idempotencyKey,
      ...input.toBatch(input.payload),
    });

    const processed = await prisma.socialInboxWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        payloadDigest: createHash("sha256").update(input.payload).digest("hex"),
      },
    });

    return { event: processed, duplicate: false, ingest };
  },
};
