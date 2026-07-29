import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentSchedule } from "@/lib/api/content-handler";
import { scheduleCreateSchema } from "@/lib/validation/scheduling";
import { schedulingService } from "@/server/services/scheduling-service";
type Params = { params: Promise<{ brandId: string; contentId: string }> };
export async function POST(request: NextRequest, { params }: Params) { const { brandId, contentId } = await params; const organisationId = requireOrganisationId(request); const body = parseBody(scheduleCreateSchema, await jsonBody(request)); return withContentSchedule(request, organisationId, async ({ requestId, tenant }) => apiSuccess(await schedulingService.schedule(brandId, organisationId, contentId, body, tenant!, requestId), { requestId })); }
