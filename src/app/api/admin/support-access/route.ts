import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withPlatformAdmin } from "@/lib/api/admin-handler";
import { supportAccessSchema } from "@/lib/validation/admin";
import { supportAccessService } from "@/server/services/support-access-service";

export async function GET(request: NextRequest) {
  return withPlatformAdmin(request, async ({ requestId }) => {
    const sessions = await supportAccessService.listActiveSessions();
    return apiSuccess({ sessions }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return withPlatformAdmin(request, async ({ requestId, user }) => {
    const input = parseBody(supportAccessSchema, body);
    const session = await supportAccessService.startSession({
      adminUserId: user.userProfileId,
      ...input,
      requestId,
    });
    return apiSuccess({ session }, { requestId });
  });
}
