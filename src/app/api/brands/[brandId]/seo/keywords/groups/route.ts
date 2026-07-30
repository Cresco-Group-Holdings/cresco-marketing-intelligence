import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { prisma } from "@/lib/database/prisma";
import {
  requireOrganisationId,
  withKeywordsManage,
  withKeywordsRead,
} from "@/lib/api/keywords-handler";
import { bulkTagSchema, createGroupSchema } from "@/lib/validation/keywords";
import { seoKeywordService } from "@/server/services/seo-keyword-service";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withKeywordsRead(request, organisationId, async ({ requestId, tenant }) => {
    await brandService.getById(brandId, organisationId, tenant!);
    const groups = await prisma.seoKeywordGroup.findMany({
      where: { brandId, organisationId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
    return apiSuccess({ items: groups }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withKeywordsManage(request, organisationId, async ({ requestId, tenant }) => {
    const brand = await brandService.getById(brandId, organisationId, tenant!);
    const input = parseBody(createGroupSchema, body);
    const group = await prisma.seoKeywordGroup.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: input.name,
        description: input.description,
        groupType: input.groupType,
      },
    });
    if (input.keywordIds?.length) {
      await prisma.seoKeywordGroupMember.createMany({
        data: input.keywordIds.map((keywordId) => ({ groupId: group.id, keywordId })),
        skipDuplicates: true,
      });
    }
    return apiSuccess({ group }, { requestId });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withKeywordsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(bulkTagSchema, body);
    const result = await seoKeywordService.bulkTag(
      brandId,
      organisationId,
      input.keywordIds,
      input.tags,
      tenant!,
    );
    return apiSuccess(result, { requestId });
  });
}
