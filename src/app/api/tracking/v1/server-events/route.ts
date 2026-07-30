import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { hashTrackingApiKey, verifyServerEventSignature } from "@/lib/tracking/api-key";
import { trackingServerEventSchema } from "@/lib/validation/tracking";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";
import { trackingIngestionService, trackingPropertyService } from "@/server/services/tracking-ingestion-service";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as unknown;
    const input = trackingServerEventSchema.parse(body);

    const apiKeyHeader = request.headers.get("x-cresco-api-key");
    const signature = request.headers.get("x-cresco-signature");
    if (!apiKeyHeader || !signature) {
      throw new AppError("UNAUTHORIZED", "API key and signature are required.");
    }

    const keyHash = hashTrackingApiKey(apiKeyHeader);
    const apiKey = await prisma.trackingApiKey.findFirst({
      where: { keyHash, status: "ACTIVE" },
      include: { trackingProperty: true },
    });
    if (!apiKey || apiKey.trackingProperty.publicPropertyId !== input.propertyId) {
      throw new AppError("UNAUTHORIZED", "Invalid API key.");
    }

    if (!verifyServerEventSignature(rawBody, apiKeyHeader, signature)) {
      throw new AppError("UNAUTHORIZED", "Invalid signature.");
    }

    const property = apiKey.trackingProperty;
    if (property.status !== "ACTIVE") {
      throw new AppError("FORBIDDEN", "Tracking property is not active.");
    }

    const account = await marketingWarehouseRegistryService.ensureSourceAccount({
      brandId: property.brandId,
      organisationId: property.organisationId,
      projectId: property.projectId,
      provider: "FIRST_PARTY",
      externalAccountId: property.publicPropertyId,
      displayName: property.name,
    });

    const event = {
      eventId: input.idempotencyKey,
      eventName: input.eventName,
      occurredAt: input.occurredAt,
      anonymousId: input.userId ? `user:${input.userId}` : `server:${input.idempotencyKey}`,
      userId: input.userId,
      consent: { ESSENTIAL: true, ANALYTICS: true, MARKETING: true },
      properties: {
        ...input.properties,
        leadId: input.leadId,
        customerId: input.customerId,
        source: "server",
      },
    };

    const resolvedProperty = await trackingPropertyService.resolveByPublicId(property.publicPropertyId);
    if (!resolvedProperty) {
      throw new AppError("NOT_FOUND", "Property not found.");
    }

    const result = await trackingIngestionService.ingestEvent(
      resolvedProperty,
      account.id,
      event,
      {
        origin: "https://server.cresco.internal",
        userAgent: "CrescoServerEvent/1.0",
        clientIp: "server",
      },
      "server",
    );

    await prisma.trackingApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return apiSuccess({ result }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
