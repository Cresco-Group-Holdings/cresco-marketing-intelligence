import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, type ApiHandlerContext } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { platformAdminService } from "@/server/services/platform-admin-service";

export async function withPlatformAdmin(
  request: NextRequest,
  handler: (context: ApiHandlerContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withApiHandler(request, async (context) => {
    const isAdmin = await platformAdminService.isPlatformAdmin(
      context.user.userProfileId,
      context.user.email,
    );

    if (!isAdmin) {
      throw new AppError("FORBIDDEN", "Platform administrator access is required.");
    }

    return handler(context);
  });
}
