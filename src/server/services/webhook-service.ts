import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { connectorCredentialService } from "@/server/services/connector-credential-service";

export const webhookService = {
  async createEndpoint(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    connectorAccountId?: string;
    path: string;
    secret: string;
  }) {
    return prisma.webhookEndpoint.create({
      data: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        connectorAccountId: input.connectorAccountId,
        path: input.path,
        secretDigest: connectorCredentialService.digestWebhookSecret(input.secret),
        status: "ACTIVE",
      },
    });
  },

  async ingestEvent(input: {
    webhookEndpointId: string;
    idempotencyKey: string;
    payload: string;
  }) {
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: input.webhookEndpointId },
    });
    if (!endpoint || endpoint.status !== "ACTIVE") {
      throw new AppError("NOT_FOUND", "Webhook endpoint was not found.");
    }

    const existing = await prisma.webhookEvent.findUnique({
      where: {
        webhookEndpointId_idempotencyKey: {
          webhookEndpointId: input.webhookEndpointId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.status === "PROCESSED") {
        return prisma.webhookEvent.update({
          where: { id: existing.id },
          data: { status: "DUPLICATE" },
        });
      }
      return existing;
    }

    return prisma.webhookEvent.create({
      data: {
        webhookEndpointId: input.webhookEndpointId,
        idempotencyKey: input.idempotencyKey,
        payloadDigest: createHash("sha256").update(input.payload).digest("hex"),
        status: "PENDING",
      },
    });
  },

  async markProcessed(eventId: string) {
    return prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
  },

  generateSecret(): string {
    return randomUUID().replace(/-/g, "");
  },
};
