import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withNotificationsWrite } from "@/lib/api/notifications-handler";
import { digestSubscriptionService } from "@/server/services/announcement-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const subscriptions = await digestSubscriptionService.list(
      organisationId,
      tenant!.userProfileId,
      tenant!,
    );
    return apiSuccess({ subscriptions }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const subscription = await digestSubscriptionService.upsert(
      organisationId,
      tenant!.userProfileId,
      body,
      tenant!,
    );
    return apiSuccess({ subscription }, { requestId });
  });
}
