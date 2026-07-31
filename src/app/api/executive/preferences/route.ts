import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import type { ExecutiveComparisonType } from "@prisma/client";
import type { ExecutiveFilters } from "@/lib/executive/types";
import { executiveDashboardService } from "@/server/services/executive-dashboard-service";

export async function GET(request: NextRequest) {
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId, user }) => {
      if (!user?.userProfileId) throw new AppError("UNAUTHORIZED", "Authentication required.");
      const prefs = await executiveDashboardService.getPreferences(user.userProfileId, organisationId);
      return apiSuccess({ preferences: prefs }, { requestId });
    },
    { organisationId },
  );
}

export async function PATCH(request: NextRequest) {
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as {
    projectId?: string | null;
    brandId?: string | null;
    dateRangeDays?: number;
    comparisonType?: ExecutiveComparisonType;
    comparisonFrom?: string | null;
    comparisonTo?: string | null;
    reportingCurrency?: string;
    filters?: ExecutiveFilters | null;
  };

  return withApiHandler(
    request,
    async ({ tenant, requestId, user }) => {
      if (!user?.userProfileId) throw new AppError("UNAUTHORIZED", "Authentication required.");
      const prefs = await executiveDashboardService.savePreferences(user.userProfileId, organisationId, {
        projectId: body.projectId,
        brandId: body.brandId,
        dateRangeDays: body.dateRangeDays,
        comparisonType: body.comparisonType,
        comparisonFrom: body.comparisonFrom ? new Date(body.comparisonFrom) : null,
        comparisonTo: body.comparisonTo ? new Date(body.comparisonTo) : null,
        reportingCurrency: body.reportingCurrency,
        filters: body.filters,
      });
      return apiSuccess({ preferences: prefs }, { requestId });
    },
    { organisationId },
  );
}
