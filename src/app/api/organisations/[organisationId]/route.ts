import { NextRequest } from "next/server";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { organisationUpdateSchema } from "@/lib/validation/workspace";
import { organisationService } from "@/server/services";

type Params = { params: Promise<{ organisationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { organisationId } = await params;
  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const organisation = await organisationService.getById(organisationId, tenant!);
      return apiSuccess({ organisation }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["organisation.read"] },
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { organisationId } = await params;
  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(organisationUpdateSchema, await jsonBody(request));
      const organisation = await organisationService.update(
        organisationId,
        {
          name: body.name,
          legalName: body.legalName || null,
          website: body.website || null,
          industry: body.industry || null,
          countryCode: body.countryCode || null,
          defaultTimezone: body.defaultTimezone || undefined,
          logoUrl: body.logoUrl || null,
        },
        tenant!,
        requestId,
      );
      return apiSuccess({ organisation }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["organisation.update"] },
  );
}
