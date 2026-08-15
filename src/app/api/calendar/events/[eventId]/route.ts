import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCalendarRead,
  withCalendarReschedule,
  withCalendarUpdate,
} from "@/lib/api/calendar-handler";
import { calendarRescheduleSchema, calendarUpdateSchema } from "@/lib/validation/calendar";
import { calendarService } from "@/server/services/calendar-service";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCalendarRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { event: await calendarService.getEvent(eventId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(calendarUpdateSchema, await jsonBody(request));

  const isRescheduleOnly =
    body.startsAt != null &&
    Object.keys(body).every((key) =>
      ["startsAt", "endsAt", "allDay", "timezone", "version"].includes(key),
    );

  if (isRescheduleOnly) {
    const rescheduleBody = parseBody(calendarRescheduleSchema, body);
    return withCalendarReschedule(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        {
          event: await calendarService.rescheduleEvent(
            eventId,
            organisationId,
            rescheduleBody,
            tenant!,
            requestId,
          ),
        },
        { requestId },
      ),
    );
  }

  return withCalendarUpdate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        event: await calendarService.updateEvent(eventId, organisationId, body, tenant!, requestId),
      },
      { requestId },
    ),
  );
}
