import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { domainEventService } from "@/server/services/domain-event-service";

async function handleProcessDue(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedSchedulerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const organisationId = request.nextUrl.searchParams.get("organisationId") ?? undefined;
  const brandId = request.nextUrl.searchParams.get("brandId");
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25;

  if (!brandId || !organisationId) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "organisationId and brandId query parameters are required.",
        },
        requestId,
      },
      { status: 400 },
    );
  }

  const result = await domainEventService.processPendingForBrand(brandId, organisationId, limit);
  return apiSuccess(result, { requestId });
}

/** Worker entry point for async domain event → automation dispatch. */
export async function GET(request: NextRequest) {
  return handleProcessDue(request);
}

export async function POST(request: NextRequest) {
  return handleProcessDue(request);
}
