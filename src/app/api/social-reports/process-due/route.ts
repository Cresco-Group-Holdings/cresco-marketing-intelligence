import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSocialReportsWorkerRequest } from "@/lib/api/worker-auth";
import { socialReportService } from "@/server/services/social-report-service";

export async function POST(request: NextRequest) {
  if (!isAuthorisedSocialReportsWorkerRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = await socialReportService.processDueSchedules();
  return apiSuccess({ processed: results.length, results });
}
