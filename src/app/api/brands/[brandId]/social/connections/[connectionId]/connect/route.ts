import { SocialProvider } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withSocialConnectionsCreate,
} from "@/lib/api/social-handler";
import { AppError } from "@/lib/errors";
import { ensureSocialAdaptersRegistered } from "@/lib/social/bootstrap";
import { socialConnectionService } from "@/server/services/social-connection-service";

type Params = { params: Promise<{ brandId: string; connectionId: string }> };

function parseProvider(value: string): SocialProvider {
  if (!(value in SocialProvider)) {
    throw new AppError("VALIDATION_ERROR", "Invalid social provider.");
  }
  return value as SocialProvider;
}

export async function POST(request: NextRequest, { params }: Params) {
  ensureSocialAdaptersRegistered();
  const { brandId, connectionId: providerParam } = await params;
  const organisationId = requireOrganisationId(request);
  const provider = parseProvider(providerParam);

  return withSocialConnectionsCreate(request, organisationId, async ({ requestId, tenant }) => {
    const result = await socialConnectionService.beginConnect(
      brandId,
      organisationId,
      provider,
      tenant!,
      requestId,
    );
    return apiSuccess({ connection: result }, { requestId });
  });
}
