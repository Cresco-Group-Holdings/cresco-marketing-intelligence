import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import type { BriefType } from "@/lib/analyst/constants";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { marketingAnalystService } from "@/server/services/marketing-analyst-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as {
    question?: string;
    briefType?: BriefType;
    dateRangeDays?: number;
    filters?: Record<string, unknown>;
  };

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      if (body.briefType) {
        const result = await marketingAnalystService.generateBrief(
          brandId,
          organisationId,
          body.briefType,
          tenant!,
          requestId,
        );
        return apiSuccess({ brief: result }, { requestId });
      }

      if (!body.question?.trim()) {
        return apiSuccess({ error: "question_required" });
      }

      const result = await marketingAnalystService.ask(
        brandId,
        organisationId,
        body.question.trim(),
        tenant!,
        { dateRangeDays: body.dateRangeDays, filters: body.filters },
        requestId,
      );
      return apiSuccess({ analysis: result }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["ai.analyst.generate"] },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  const savedOnly = request.nextUrl.searchParams.get("saved") === "true";
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const runs = await marketingAnalystService.listRuns(brandId, organisationId, tenant!, { savedOnly });
      return apiSuccess({ runs }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["ai.analyst.read"] },
  );
}
