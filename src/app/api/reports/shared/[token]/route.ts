import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { socialReportService } from "@/server/services/social-report-service";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  return apiSuccess(await socialReportService.getByShareToken(token));
}
