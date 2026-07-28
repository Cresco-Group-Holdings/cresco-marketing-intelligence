import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withSocialAccountsAssign,
} from "@/lib/api/social-handler";
import { ensureSocialAdaptersRegistered } from "@/lib/social/bootstrap";
import { assignSocialAccountSchema } from "@/lib/validation/social";
import { socialConnectionService } from "@/server/services/social-connection-service";

type Params = { params: Promise<{ brandId: string; connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  ensureSocialAdaptersRegistered();
  const { brandId, connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(assignSocialAccountSchema, await request.json());

  return withSocialAccountsAssign(request, organisationId, async ({ requestId, tenant }) => {
    const account = await socialConnectionService.assignAccount(
      brandId,
      organisationId,
      connectionId,
      body.providerAccountId,
      tenant!,
      requestId,
    );
    return apiSuccess({ account }, { requestId });
  });
}
