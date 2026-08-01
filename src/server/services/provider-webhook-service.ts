import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getProviderDefinition } from "@/lib/providers/registry";
import { digestWebhookPayload } from "@/lib/providers/oauth/pkce";
import {
  extractWebhookEventId,
  isWebhookTimestampValid,
  verifyHmacWebhookSignature,
} from "@/lib/providers/webhook/verification";
import { providerAuditService } from "@/server/services/provider-audit-service";
import type { ProviderWebhookEventStatus } from "@prisma/client";

export const providerWebhookService = {
  async ingestWebhook(input: {
    providerKey: string;
    rawBody: string;
    headers: Record<string, string | undefined>;
    signature?: string;
    timestamp?: string;
  }) {
    const definition = getProviderDefinition(input.providerKey);
    if (!definition) {
      return { status: 404 as const, message: "Unknown provider." };
    }

    if (!definition.webhookSupport) {
      return { status: 400 as const, message: "Provider does not support webhooks." };
    }

    if (!isWebhookTimestampValid(input.timestamp)) {
      await this.recordRejectedEvent(input.providerKey, "TIMESTAMP_OUT_OF_TOLERANCE", input.rawBody);
      return { status: 400 as const, message: "Webhook timestamp out of tolerance." };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(input.rawBody);
    } catch {
      await this.recordRejectedEvent(input.providerKey, "INVALID_JSON", input.rawBody);
      return { status: 400 as const, message: "Invalid JSON payload." };
    }

    const externalEventId = extractWebhookEventId(payload);
    if (!externalEventId) {
      await this.recordRejectedEvent(input.providerKey, "MISSING_EVENT_ID", input.rawBody);
      return { status: 400 as const, message: "Missing event ID." };
    }

    const existing = await prisma.providerWebhookEvent.findUnique({
      where: {
        providerKey_externalEventId: {
          providerKey: input.providerKey,
          externalEventId,
        },
      },
    });
    if (existing) {
      return { status: 200 as const, message: "Duplicate event.", eventId: existing.id };
    }

    const connection = await this.resolveConnectionFromPayload(input.providerKey, payload);
    if (!connection) {
      await this.recordRejectedEvent(input.providerKey, "CONNECTION_NOT_RESOLVED", input.rawBody);
      return { status: 404 as const, message: "Connection not resolved." };
    }

    if (input.signature && connection.webhookSecret) {
      const verified = verifyHmacWebhookSignature({
        rawBody: input.rawBody,
        signature: input.signature,
        secret: connection.webhookSecret,
        timestamp: input.timestamp,
      });
      if (!verified) {
        await this.recordRejectedEvent(
          input.providerKey,
          "SIGNATURE_INVALID",
          input.rawBody,
          connection.organisationId,
          connection.connectionId,
        );
        return { status: 401 as const, message: "Signature verification failed." };
      }
    } else {
      await this.recordRejectedEvent(
        input.providerKey,
        "SIGNATURE_REQUIRED",
        input.rawBody,
        connection.organisationId,
        connection.connectionId,
      );
      return { status: 401 as const, message: "Webhook signature required." };
    }

    const event = await prisma.providerWebhookEvent.create({
      data: {
        organisationId: connection.organisationId,
        connectionId: connection.connectionId,
        providerKey: input.providerKey,
        externalEventId,
        eventType: typeof (payload as Record<string, unknown>).type === "string"
          ? ((payload as Record<string, unknown>).type as string)
          : undefined,
        status: "VERIFIED",
        payloadDigest: digestWebhookPayload(input.rawBody),
      },
    });

    await providerAuditService.recordEvent({
      organisationId: connection.organisationId,
      providerKey: input.providerKey,
      action: "WEBHOOK_RECEIVED",
      connectionId: connection.connectionId,
      result: "success",
      metadata: { eventId: event.id, externalEventId },
    });

    return { status: 200 as const, message: "Accepted.", eventId: event.id };
  },

  async resolveConnectionFromPayload(
    providerKey: string,
    payload: unknown,
  ): Promise<{ organisationId: string; connectionId: string; webhookSecret?: string } | null> {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const record = payload as Record<string, unknown>;
    const externalAccountId =
      typeof record.account_id === "string"
        ? record.account_id
        : typeof record.accountId === "string"
          ? record.accountId
          : undefined;

    if (!externalAccountId) {
      return null;
    }

    const connection = await prisma.providerConnection.findFirst({
      where: {
        providerKey,
        externalAccountId,
        status: { in: ["CONNECTED", "DEGRADED"] },
      },
      include: {
        webhookEndpoints: { where: { isActive: true }, take: 1 },
      },
    });

    if (!connection) {
      return null;
    }

    return {
      organisationId: connection.organisationId,
      connectionId: connection.id,
      webhookSecret: connection.webhookEndpoints[0]?.secretDigest ?? undefined,
    };
  },

  async recordRejectedEvent(
    providerKey: string,
    errorCode: string,
    rawBody: string,
    organisationId?: string,
    connectionId?: string,
  ) {
    if (!organisationId) {
      return;
    }

    const status: ProviderWebhookEventStatus = "REJECTED";
    await prisma.providerWebhookEvent.create({
      data: {
        organisationId,
        connectionId,
        providerKey,
        status,
        errorCode,
        payloadDigest: digestWebhookPayload(rawBody),
      },
    });

    await providerAuditService.recordEvent({
      organisationId,
      providerKey,
      action: "WEBHOOK_REJECTED",
      connectionId,
      result: "failure",
      errorCode,
    });
  },
};
