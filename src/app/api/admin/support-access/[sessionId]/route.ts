import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withPlatformAdmin } from "@/lib/api/admin-handler";
import { supportAccessService } from "@/server/services/support-access-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return withPlatformAdmin(request, async ({ requestId, user }) => {
    const session = await supportAccessService.revokeSession(
      sessionId,
      user.userProfileId,
      requestId,
    );
    return apiSuccess({ session }, { requestId });
  });
}
