import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  leadFilters,
  requireOrganisationId,
  withLeadsRead,
  withLeadsWrite,
} from "@/lib/api/leads-handler";
import { leadCreateSchema } from "@/lib/validation/leads";
import { marketingLeadQueryService } from "@/server/services/marketing-lead-query-service";
import { marketingLeadService } from "@/server/services/marketing-lead-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = leadFilters(request);

  return withLeadsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        summary: await marketingLeadQueryService.summary(brandId, organisationId, tenant!),
        ...(await marketingLeadQueryService.list(brandId, organisationId, filters, tenant!)),
      },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(leadCreateSchema, await jsonBody(request));

  return withLeadsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingLeadService.create(brandId, organisationId, body, tenant!),
      { requestId },
    ),
  );
}
