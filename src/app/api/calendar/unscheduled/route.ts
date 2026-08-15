import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withCalendarRead } from "@/lib/api/calendar-handler";
import { calendarUnscheduledFiltersSchema } from "@/lib/validation/calendar";
import { calendarService } from "@/server/services/calendar-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = parseBody(
    calendarUnscheduledFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withCalendarRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        items: await calendarService.listUnscheduledContent(
          filters.brandId,
          organisationId,
          tenant!,
          filters.limit,
        ),
      },
      { requestId },
    ),
  );
}
