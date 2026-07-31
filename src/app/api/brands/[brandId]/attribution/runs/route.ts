import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { attributionEngineService } from "@/server/services/attribution-engine-service";

function parseDateRange(searchParams: URLSearchParams) {
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const days = Number(searchParams.get("days") ?? "28");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - Math.max(1, days) * 86_400_000);
  return { from, to };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const runs = await import("@/lib/database/prisma").then(({ prisma }) =>
        prisma.attributionRun.findMany({
          where: { brandId, organisationId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { attributionModel: true },
        }),
      );
      return apiSuccess({ runs }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.read"] },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as {
    modelId?: string;
    triggerReason?: "MANUAL" | "MODEL_CHANGE" | "LATE_EVENT" | "IDENTITY_CONFIRMED" | "REFUND" | "CAMPAIGN_MAPPING_CHANGE" | "EXCLUSION_RULE_CHANGE" | "SCHEDULED";
    from?: string;
    to?: string;
    days?: number;
  };

  const { from, to } = parseDateRange(request.nextUrl.searchParams);
  const resolvedFrom = body.from ? new Date(body.from) : from;
  const resolvedTo = body.to ? new Date(body.to) : to;

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const run = await attributionEngineService.runAttribution(
        brandId,
        organisationId,
        {
          modelId: body.modelId,
          triggerReason: body.triggerReason ?? "MANUAL",
          from: resolvedFrom,
          to: resolvedTo,
        },
        tenant!,
      );
      return apiSuccess({ run }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.reprocess"] },
  );
}
