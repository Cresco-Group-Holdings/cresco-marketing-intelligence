import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withNotificationsRead } from "@/lib/api/notifications-handler";
import { announcementService } from "@/server/services/announcement-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  return withNotificationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const announcements = await announcementService.listActive(organisationId, tenant!.userProfileId);
    return apiSuccess({ announcements }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withNotificationsRead(request, organisationId, async ({ requestId, tenant }) => {
    if (body.action === "dismiss" && body.announcementId) {
      await announcementService.dismiss(body.announcementId, tenant!.userProfileId, tenant!);
      return apiSuccess({ dismissed: true }, { requestId });
    }
    const announcement = await announcementService.create(organisationId, body, tenant!);
    return apiSuccess({ announcement }, { requestId });
  });
}
