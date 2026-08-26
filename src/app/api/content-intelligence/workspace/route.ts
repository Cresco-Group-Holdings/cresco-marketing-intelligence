import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { contentIntelligenceService } from "@/server/services/content-intelligence-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const workspace = await contentIntelligenceService.getWorkspace({
      userProfileId: user.userProfileId,
    });
    return apiSuccess({ workspace }, { requestId });
  });
}
