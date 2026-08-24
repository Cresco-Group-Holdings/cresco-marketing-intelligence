import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { parseMarketingDateRangeSearchParams } from "@/lib/marketing/date-range";
import { organicGrowthEngineService } from "@/server/services/organic-growth-engine-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const range = parseMarketingDateRangeSearchParams(request.nextUrl.searchParams);
    const engine = await organicGrowthEngineService.getEngine(user.userProfileId, range);
    return apiSuccess({ engine }, { requestId });
  });
}
