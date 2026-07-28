import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { organisationService } from "@/server/services";

type Params = { params: Promise<{ organisationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { organisationId } = await params;
  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const organisation = await organisationService.archive(organisationId, tenant!, requestId);
      return apiSuccess({ organisation }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["organisation.archive"] },
  );
}
