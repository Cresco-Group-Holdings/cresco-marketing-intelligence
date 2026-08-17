import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { parseMarketingDateRangeSearchParams } from "@/lib/marketing/date-range";
import { marketingCommandCentreService } from "@/server/services/marketing-command-centre-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const range = parseMarketingDateRangeSearchParams(request.nextUrl.searchParams);
    const dashboard = await marketingCommandCentreService.getDashboard(user.userProfileId, range);
    return apiSuccess({ dashboard }, { requestId });
  });
}
