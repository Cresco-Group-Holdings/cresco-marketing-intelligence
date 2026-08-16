import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { parseMarketingDateRangeSearchParams } from "@/lib/marketing/date-range";
import { unifiedAnalyticsWorkspaceService } from "@/server/services/unified-analytics-workspace-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const range = parseMarketingDateRangeSearchParams(request.nextUrl.searchParams);
    const model = request.nextUrl.searchParams.get("model");
    const workspace = await unifiedAnalyticsWorkspaceService.getWorkspace(
      user.userProfileId,
      range,
      model,
    );
    return apiSuccess({ workspace }, { requestId });
  });
}
