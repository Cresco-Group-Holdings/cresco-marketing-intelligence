import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/database/prisma";
import { PROVIDER_ERROR_CODES } from "@/lib/providers/errors";
import { resolvePlatformAdapter } from "@/lib/providers/platform-registry";

type Params = { params: Promise<{ providerKey: string; endpointKey: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { providerKey, endpointKey } = await params;
  const rawBody = await request.text();
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  const endpoint = await prisma.providerWebhookEndpoint.findFirst({
    where: { providerKey, endpointKey, status: "ACTIVE", isActive: true },
    include: { connection: true },
  });

  if (!endpoint || !endpoint.connection) {
    return apiSuccess({ error: PROVIDER_ERROR_CODES.PROVIDER_CONNECTION_NOT_FOUND }, { status: 404 });
  }

  const duplicate = await prisma.providerWebhookEvent.findFirst({
    where: {
      providerKey,
      OR: [
        { payloadDigest: payloadHash },
        ...(request.headers.get("x-mock-event-id")
          ? [{ externalEventId: request.headers.get("x-mock-event-id")! }]
          : []),
      ],
    },
  });
  if (duplicate) {
    return apiSuccess({ status: "DUPLICATE", eventId: duplicate.id });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return apiSuccess({ error: PROVIDER_ERROR_CODES.PROVIDER_INVALID_REQUEST }, { status: 400 });
  }

  const signature = request.headers.get("x-webhook-signature");
  if (endpoint.secretDigest && signature !== endpoint.secretDigest) {
    return apiSuccess({ error: PROVIDER_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID }, { status: 401 });
  }

  const adapter = resolvePlatformAdapter({ providerKey, apiVersion: endpoint.connection.providerVersion });
  const event = {
    providerEventId: String(request.headers.get("x-mock-event-id") ?? payloadHash),
    eventType: String(payload.type ?? "unknown"),
    payloadHash,
    receivedAt: new Date().toISOString(),
    payload,
  };

  const eventRow = await prisma.providerWebhookEvent.create({
    data: {
      organisationId: endpoint.organisationId,
      connectionId: endpoint.connectionId,
      endpointId: endpoint.id,
      providerKey,
      externalEventId: event.providerEventId,
      eventType: event.eventType,
      status: "RECEIVED",
      payloadDigest: payloadHash,
    },
  });

  if (adapter.handleWebhook) {
    const result = await adapter.handleWebhook(event, {
      organisationId: endpoint.organisationId,
      connectionId: endpoint.connectionId,
      providerKey,
      apiVersion: endpoint.connection.providerVersion,
      configuration: (endpoint.connection.configuration as Record<string, unknown>) ?? {},
      correlationId: crypto.randomUUID(),
      decryptCredential: async () => null,
    });

    await prisma.providerWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        status: result.status === "PROCESSED" ? "PROCESSED" : result.status === "IGNORED" ? "DUPLICATE" : "REJECTED",
        processedAt: new Date(),
      },
    });
  }

  await prisma.providerWebhookEndpoint.update({
    where: { id: endpoint.id },
    data: { lastReceivedAt: new Date() },
  });

  return apiSuccess({ status: "RECEIVED", eventId: eventRow.id });
}
