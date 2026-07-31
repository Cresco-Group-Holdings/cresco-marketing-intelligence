import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withComplianceRead, withComplianceWrite } from "@/lib/api/compliance-handler";
import { compliancePolicyCreateSchema } from "@/lib/validation/compliance";
import { compliancePolicyService } from "@/server/services/compliance-policy-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  return withComplianceRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        policies: await compliancePolicyService.list(brandId, tenant!.organisationId, tenant!),
      },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const templateKey = request.nextUrl.searchParams.get("templateKey");
  if (templateKey) {
    return withComplianceWrite(request, async ({ requestId, tenant }) =>
      apiSuccess(
        {
          policy: await compliancePolicyService.installTemplate(
            brandId,
            tenant!.organisationId,
            templateKey,
            tenant!,
          ),
        },
        { requestId },
      ),
    );
  }

  const body = parseBody(compliancePolicyCreateSchema, await jsonBody(request));
  return withComplianceWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        policy: await compliancePolicyService.installTemplate(
          brandId,
          tenant!.organisationId,
          body.templateKey ?? body.slug,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
