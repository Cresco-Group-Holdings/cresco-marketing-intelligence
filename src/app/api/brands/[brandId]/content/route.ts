import { ContentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentCreate,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentCreateSchema } from "@/lib/validation/content";
import { contentService } from "@/server/services/content-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const status = request.nextUrl.searchParams.get("status");
  const ownerUserId = request.nextUrl.searchParams.get("ownerUserId") ?? undefined;
  const provider = request.nextUrl.searchParams.get("provider") ?? undefined;
  const search = request.nextUrl.searchParams.get("search") ?? undefined;

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const items = await contentService.list(brandId, organisationId, tenant!, {
      status: status ? (status as ContentStatus) : undefined,
      ownerUserId,
      provider: provider as import("@prisma/client").SocialProvider | undefined,
      search,
    });
    return apiSuccess({ items }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentCreateSchema, await jsonBody(request));

  return withContentCreate(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentService.create(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess({ item }, { requestId });
  });
}
