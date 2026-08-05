import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withCalendarUpdate } from "@/lib/api/calendar-handler";
import { calendarService } from "@/server/services/calendar-service";

type Params = { params: Promise<{ eventId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCalendarUpdate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { event: await calendarService.cancelEvent(eventId, organisationId, tenant!, requestId) },
      { requestId },
    ),
  );
}
