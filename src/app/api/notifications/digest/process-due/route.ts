import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { notificationDigestService } from "@/server/services/notification-service";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Worker authorization failed.",
        },
        requestId,
      },
      { status: 403 },
    );
  }

  const period = request.nextUrl.searchParams.get("period");
  const frequency =
    period === "weekly" ? "DIGEST_WEEKLY" : ("DIGEST_DAILY" as "DIGEST_DAILY" | "DIGEST_WEEKLY");

  return apiSuccess(
    {
      digests: await notificationDigestService.processDue(frequency),
    },
    { requestId },
  );
}
