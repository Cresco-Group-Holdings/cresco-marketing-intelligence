import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { instagramPublishingService } from "@/server/services/instagram-publishing-service";
type Params = { params: Promise<{ jobId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const token = process.env.PUBLISHING_WORKER_TOKEN;
  const authorization = request.headers.get("authorization");
  if (!token || authorization !== `Bearer ${token}`) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Worker authorization failed." } }, { status: 403 });
  }
  return apiSuccess({ result: await instagramPublishingService.process(jobId) }, { requestId: crypto.randomUUID() });
}
