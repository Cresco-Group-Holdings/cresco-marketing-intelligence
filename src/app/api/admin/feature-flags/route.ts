import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withPlatformAdmin } from "@/lib/api/admin-handler";
import { featureFlagSchema } from "@/lib/validation/admin";
import { platformFeatureFlagService } from "@/server/services/platform-feature-flag-service";
import { adminCentreService } from "@/server/services/admin-centre-service";

export async function GET(request: NextRequest) {
  return withPlatformAdmin(request, async ({ requestId }) => {
    const flags = await platformFeatureFlagService.list();
    return apiSuccess({ flags }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return withPlatformAdmin(request, async ({ requestId, user }) => {
    const input = parseBody(featureFlagSchema, body);
    const flag = await platformFeatureFlagService.upsert(input);

    await adminCentreService.recordAdminAction({
      actorUserId: user.userProfileId,
      action: "FEATURE_FLAG_UPDATED",
      resourceType: "platform_feature_flag",
      resourceId: flag.id,
      requestId,
      metadata: { key: flag.key, enabled: flag.enabled },
    });

    return apiSuccess({ flag }, { requestId });
  });
}
