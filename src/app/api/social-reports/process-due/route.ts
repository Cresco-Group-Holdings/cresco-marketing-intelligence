import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { socialReportService } from "@/server/services/social-report-service";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SOCIAL_REPORTS_WORKER_SECRET ?? ""}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = await socialReportService.processDueSchedules();
  return apiSuccess({ processed: results.length, results });
}
