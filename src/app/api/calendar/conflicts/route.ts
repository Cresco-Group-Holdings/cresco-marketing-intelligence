import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withCalendarRead } from "@/lib/api/calendar-handler";
import { calendarConflictsFiltersSchema } from "@/lib/validation/calendar";
import { calendarService } from "@/server/services/calendar-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = parseBody(
    calendarConflictsFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withCalendarRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        conflicts: await calendarService.detectConflicts(
          organisationId,
          new Date(filters.from),
          new Date(filters.to),
          tenant!,
          {
            brandId: filters.brandId,
            channel: filters.channel,
            timezone: filters.timezone,
          },
        ),
      },
      { requestId },
    ),
  );
}
