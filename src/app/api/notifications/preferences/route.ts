import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withNotificationsRead,
  withNotificationsWrite,
} from "@/lib/api/notifications-handler";
import { notificationPreferenceSchema } from "@/lib/validation/notifications";
import { notificationPreferenceService } from "@/server/services/notification-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  return withNotificationsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        preferences: await notificationPreferenceService.list(
          organisationId,
          tenant!.userProfileId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}

export async function PUT(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = parseBody(notificationPreferenceSchema, await jsonBody(request));
  return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        preference: await notificationPreferenceService.upsert(
          organisationId,
          tenant!.userProfileId,
          body,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
