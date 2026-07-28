import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { foundationDashboardService } from "@/server/services/foundation-dashboard-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const organisationId =
      request.nextUrl.searchParams.get("organisationId") ??
      request.headers.get("x-organisation-id");

    const dashboard = await foundationDashboardService.getDashboard(user.userProfileId);

    if (
      organisationId &&
      dashboard.workspace.organisation?.id &&
      dashboard.workspace.organisation.id !== organisationId
    ) {
      throw new AppError("FORBIDDEN", "Organisation context does not match the active workspace.");
    }

    return apiSuccess({ dashboard }, { requestId });
  });
}
