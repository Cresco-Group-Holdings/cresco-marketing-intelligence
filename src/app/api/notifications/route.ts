import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  notificationFilters,
  requireOrganisationId,
  withNotificationsRead,
  withNotificationsWrite,
} from "@/lib/api/notifications-handler";
import { notificationService } from "@/server/services/notification-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = notificationFilters(request);

  return withNotificationsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        unread: await notificationService.unreadCount(
          organisationId,
          tenant!.userProfileId,
          tenant!,
        ),
        ...(await notificationService.listForUser(
          organisationId,
          tenant!.userProfileId,
          filters,
          tenant!,
        )),
      },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const notificationId = request.nextUrl.searchParams.get("notificationId");
  if (!notificationId) {
    return apiSuccess({ error: "notificationId required" }, { requestId: "missing" });
  }

  return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        notification: await notificationService.markRead(
          organisationId,
          tenant!.userProfileId,
          notificationId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
