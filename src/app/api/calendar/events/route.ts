import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  calendarListFilters,
  requireOrganisationId,
  withCalendarCreate,
  withCalendarRead,
} from "@/lib/api/calendar-handler";
import { calendarCreateSchema } from "@/lib/validation/calendar";
import { calendarService } from "@/server/services/calendar-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = calendarListFilters(request);

  return withCalendarRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(await calendarService.listEvents(organisationId, filters, tenant!), { requestId }),
  );
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = parseBody(calendarCreateSchema, await jsonBody(request));

  return withCalendarCreate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { event: await calendarService.createManualEvent(organisationId, body, tenant!, requestId) },
      { requestId },
    ),
  );
}
