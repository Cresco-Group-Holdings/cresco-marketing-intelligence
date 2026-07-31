import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOnPageAudit,
  withOnPageManage,
  withOnPageOverride,
  withOnPageRead,
} from "@/lib/api/on-page-handler";
import { comparisonSchema, overrideSchema, recommendationStatusSchema } from "@/lib/validation/on-page";
import { onPageAuditService } from "@/server/services/on-page-audit-service";
import { onPageCheckService } from "@/server/services/on-page-check-service";
import { onPageComparisonService } from "@/server/services/on-page-comparison-service";
import { onPageOverrideService } from "@/server/services/on-page-override-service";

type Params = { params: Promise<{ brandId: string; pageId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, pageId } = await params;
  const organisationId = requireOrganisationId(request);
  return withOnPageRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ audit: await onPageAuditService.getById(pageId, brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, pageId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json().catch(() => ({}));

  if (action === "run-audit") {
    return withOnPageAudit(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        { audit: await onPageCheckService.runAudit(pageId, brandId, organisationId, tenant!) },
        { requestId },
      ),
    );
  }

  if (action === "override") {
    return withOnPageOverride(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(overrideSchema, body);
      const override = await onPageOverrideService.createOverride(pageId, brandId, organisationId, input, tenant!);
      return apiSuccess({ override }, { requestId });
    });
  }

  if (action === "compare") {
    return withOnPageRead(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(comparisonSchema, body);
      const comparison = await onPageComparisonService.compare(pageId, brandId, organisationId, input, tenant!);
      return apiSuccess({ comparison }, { requestId });
    });
  }

  if (action === "recommendation-status") {
    return withOnPageManage(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(recommendationStatusSchema, body);
      const recommendation = await onPageOverrideService.updateRecommendationStatus(
        pageId,
        brandId,
        organisationId,
        input.recommendationId,
        input.status,
        tenant!,
      );
      return apiSuccess({ recommendation }, { requestId });
    });
  }

  return withOnPageRead(request, organisationId, async ({ requestId }) =>
    apiSuccess({ error: "Unknown action" }, { requestId }),
  );
}
