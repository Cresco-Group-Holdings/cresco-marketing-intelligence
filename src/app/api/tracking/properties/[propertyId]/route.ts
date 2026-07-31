import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withTrackingManage, withTrackingRead, withTrackingViewRaw } from "@/lib/api/tracking-handler";
import { prisma } from "@/lib/database/prisma";
import { trackingPropertyService } from "@/server/services/tracking-ingestion-service";
import { brandService } from "@/server/services/workspace-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;
  const brandId = request.nextUrl.searchParams.get("brandId");
  const view = request.nextUrl.searchParams.get("view");

  if (view === "events" || view === "raw") {
    const handler = view === "raw" ? withTrackingViewRaw : withTrackingRead;
    return handler(request, async ({ tenant, requestId }) => {
      if (!brandId) {
        return apiSuccess({ items: [] }, { requestId });
      }
      await brandService.getById(brandId, tenant!.organisationId, tenant!);
      const items = await prisma.trackingIngestLog.findMany({
        where: {
          organisationId: tenant!.organisationId,
          brandId,
          trackingPropertyId: propertyId,
        },
        orderBy: { receivedAt: "desc" },
        take: 50,
        select:
          view === "raw"
            ? {
                id: true,
                eventName: true,
                status: true,
                receivedAt: true,
                quarantineReason: true,
                origin: true,
                userAgent: true,
                clientTimestamp: true,
                payloadSummary: true,
                idempotencyKey: true,
              }
            : {
                id: true,
                eventName: true,
                status: true,
                receivedAt: true,
                quarantineReason: true,
                origin: true,
              },
      });
      return apiSuccess({ items }, { requestId });
    });
  }

  return withTrackingRead(request, async ({ tenant, requestId }) => {
    const property = await prisma.trackingProperty.findFirst({
      where: { id: propertyId, organisationId: tenant!.organisationId },
      include: { domains: true, environments: true, installations: true },
    });
    return apiSuccess({ property }, { requestId });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;
  const body = (await request.json()) as { name?: string };

  return withTrackingManage(request, async ({ tenant, requestId }) => {
    const property = await prisma.trackingProperty.findFirst({
      where: { id: propertyId, organisationId: tenant!.organisationId },
    });
    if (!property) {
      return apiSuccess({ error: "not_found" }, { requestId });
    }

    const { apiKey: key, record } = await trackingPropertyService.createApiKey(
      tenant!.organisationId,
      { propertyId, name: body.name ?? "Server events" },
      tenant!,
    );

    return apiSuccess({ apiKey: key, keyPrefix: record.keyPrefix }, { requestId });
  });
}
