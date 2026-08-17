import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { parseMarketingDateRangeSearchParams } from "@/lib/marketing/date-range";
import { organicSocialWorkspaceService } from "@/server/services/organic-social-workspace-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const range = parseMarketingDateRangeSearchParams(request.nextUrl.searchParams);
    const workspace = await organicSocialWorkspaceService.getWorkspace(
      user.userProfileId,
      range,
    );
    return apiSuccess({ workspace }, { requestId });
  });
}
