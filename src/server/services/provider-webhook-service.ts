import { prisma } from "@/lib/database/prisma";
import { digestWebhookPayload } from "@/lib/providers/oauth/pkce";
import { resolveWebhookAdapter } from "@/lib/providers/registry";
import { getProviderDefinition } from "@/lib/providers/registry";
import { isWebhookTimestampValid } from "@/lib/providers/webhook/verification";
import { RESEND_WEBHOOK_HEADERS } from "@/server/providers/resend/resend-webhook";
import { extractResendWebhookEventId } from "@/server/providers/resend/resend-webhook";
import { providerAuditService } from "@/server/services/provider-audit-service";
import { providerCredentialService } from "@/server/services/provider-credential-service";
import { resendWebhookProcessorService } from "@/server/services/resend-webhook-processor-service";
import { processResendWebhookPayload } from "@/server/providers/resend/resend-webhook";
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

    const webhookAdapter = resolveWebhookAdapter(input.providerKey);
    const eventId =
      input.providerKey === "resend"
        ? extractResendWebhookEventId(input.headers)
        : webhookAdapter?.extractEventId(
            (() => {
              try {
                return JSON.parse(input.rawBody);
              } catch {
                return null;
              }
            })(),
          );

    if (!eventId) {
      await this.recordRejectedEvent(input.providerKey, "MISSING_EVENT_ID", input.rawBody);
      return { status: 400 as const, message: "Missing event ID." };
    }

    const existing = await prisma.providerWebhookEvent.findUnique({
      where: {
        providerKey_externalEventId: {
          providerKey: input.providerKey,
          externalEventId: eventId,
        },
      },
    });
    if (existing) {
      return { status: 200 as const, message: "Duplicate event.", eventId: existing.id };
    }

    const timestamp =
      input.timestamp ??
      input.headers[RESEND_WEBHOOK_HEADERS.timestamp] ??
      input.headers["svix-timestamp"];

    if (!isWebhookTimestampValid(timestamp)) {
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

    const resolved = await this.resolveConnectionForWebhook(input.providerKey, input.rawBody, input.headers);
    if (!resolved) {
      await this.recordRejectedEvent(input.providerKey, "CONNECTION_NOT_RESOLVED", input.rawBody);
      return { status: 404 as const, message: "Connection not resolved." };
    }

    const verified = webhookAdapter
      ? webhookAdapter.verifyWebhookSignature({
          rawBody: input.rawBody,
          headers: input.headers,
          secret: resolved.webhookSecret,
        })
      : false;

    if (!verified) {
      await this.recordRejectedEvent(
        input.providerKey,
        "SIGNATURE_INVALID",
        input.rawBody,
        resolved.organisationId,
        resolved.connectionId,
      );
      return { status: 401 as const, message: "Signature verification failed." };
    }

    const eventType =
      webhookAdapter?.extractEventType(payload) ??
      (typeof (payload as Record<string, unknown>).type === "string"
        ? ((payload as Record<string, unknown>).type as string)
        : undefined);

    const event = await prisma.providerWebhookEvent.create({
      data: {
        organisationId: resolved.organisationId,
        connectionId: resolved.connectionId,
        endpointId: resolved.endpointId,
        providerKey: input.providerKey,
        externalEventId: eventId,
        eventType,
        status: "VERIFIED",
        payloadDigest: digestWebhookPayload(input.rawBody),
      },
    });

    await providerAuditService.recordEvent({
      organisationId: resolved.organisationId,
      providerKey: input.providerKey,
      action: "WEBHOOK_RECEIVED",
      connectionId: resolved.connectionId,
      result: "success",
      metadata: { eventId: event.id, externalEventId: eventId, eventType },
    });

    if (input.providerKey === "resend") {
      const normalized = processResendWebhookPayload(input.rawBody, eventId);
      if (normalized) {
        void resendWebhookProcessorService
          .processNormalizedEvent({
            organisationId: resolved.organisationId,
            connectionId: resolved.connectionId,
            event: normalized,
            webhookEventId: event.id,
          })
          .catch(() => undefined);
      }
    }

    return { status: 200 as const, message: "Accepted.", eventId: event.id };
  },

  async resolveConnectionForWebhook(
    providerKey: string,
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<{
    organisationId: string;
    connectionId: string;
    webhookSecret: string;
    endpointId?: string;
  } | null> {
    if (providerKey === "resend") {
      const endpoints = await prisma.providerWebhookEndpoint.findMany({
        where: { providerKey: "resend", isActive: true },
        include: { connection: true },
      });

      const webhookAdapter = resolveWebhookAdapter("resend");
      if (!webhookAdapter) return null;

      for (const endpoint of endpoints) {
        const secret = await providerCredentialService.getCredentialPlaintext(
          endpoint.connectionId,
          "WEBHOOK_SIGNING_SECRET",
        );
        if (!secret) continue;

        const verified = webhookAdapter.verifyWebhookSignature({
          rawBody,
          headers,
          secret,
        });

        if (verified) {
          return {
            organisationId: endpoint.organisationId,
            connectionId: endpoint.connectionId,
            webhookSecret: secret,
            endpointId: endpoint.id,
          };
        }
      }
      return null;
    }

    return this.resolveConnectionFromPayload(providerKey, JSON.parse(rawBody));
  },

  async resolveConnectionFromPayload(
    providerKey: string,
    payload: unknown,
  ): Promise<{ organisationId: string; connectionId: string; webhookSecret: string } | null> {
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

    const webhookSecret = connection.webhookEndpoints[0]
      ? await providerCredentialService.getCredentialPlaintext(
          connection.id,
          "WEBHOOK_SIGNING_SECRET",
        )
      : undefined;

    if (!webhookSecret) return null;

    return {
      organisationId: connection.organisationId,
      connectionId: connection.id,
      webhookSecret,
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
