import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withPlatformAdmin } from "@/lib/api/admin-handler";
import { announcementSchema } from "@/lib/validation/admin";
import { announcementService } from "@/server/services/announcement-service";
import { adminCentreService } from "@/server/services/admin-centre-service";

export async function GET(request: NextRequest) {
  return withPlatformAdmin(request, async ({ requestId }) => {
    const announcements = await announcementService.listAll();
    return apiSuccess({ announcements }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return withPlatformAdmin(request, async ({ requestId, user }) => {
    const input = parseBody(announcementSchema, body);
    const announcement = await announcementService.create({
      ...input,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      createdById: user.userProfileId,
    });

    await adminCentreService.recordAdminAction({
      actorUserId: user.userProfileId,
      action: "ANNOUNCEMENT_CREATED",
      resourceType: "system_announcement",
      resourceId: announcement.id,
      requestId,
    });

    return apiSuccess({ announcement }, { requestId });
  });
}
