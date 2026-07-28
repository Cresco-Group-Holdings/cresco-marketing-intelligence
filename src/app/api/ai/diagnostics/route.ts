import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody, withApiHandler, getOrganisationIdFromRequest } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { assertAiDiagnosticsAccess } from "@/lib/ai/diagnostics-access";
import { aiModelRegistry } from "@/lib/ai/model-registry";
import { listConfiguredProviders } from "@/lib/ai/providers";
import { getUsageSummary } from "@/lib/ai/cost-controls";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { aiDiagnosticsTestSchema } from "@/lib/validation/ai";
import { aiRequestService } from "@/server/services/ai-request-service";

function requireOrganisationId(request: NextRequest): string {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }
  return organisationId;
}

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      assertAiDiagnosticsAccess(tenant!.organisationRole);
      return apiSuccess(
        {
          enabled: true,
          providers: listConfiguredProviders(),
          models: aiModelRegistry.listModels(),
        },
        { requestId },
      );
    },
    { organisationId, permission: PERMISSIONS["ai.diagnostics"] },
  );
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      assertAiDiagnosticsAccess(tenant!.organisationRole);
      const body = parseBody(aiDiagnosticsTestSchema, await jsonBody(request));

      const result =
        body.mode === "structured"
          ? await aiRequestService.executeStructured(
              {
                organisationId,
                brandId: body.brandId,
                userProfileId: tenant!.userProfileId,
                purpose: "DIAGNOSTICS_TEST",
                provider: body.provider,
                model: body.model,
                templateKey: "diagnostics.structured",
                userInput: body.userInput,
                requestId,
                schemaKey: "diagnostics.structured",
              },
              tenant!,
            )
          : await aiRequestService.executeText(
              {
                organisationId,
                brandId: body.brandId,
                userProfileId: tenant!.userProfileId,
                purpose: "DIAGNOSTICS_TEST",
                provider: body.provider,
                model: body.model,
                templateKey: "diagnostics.ping",
                userInput: body.userInput,
                requestId,
              },
              tenant!,
            );

      const usage = await getUsageSummary(organisationId, tenant!.userProfileId);
      return apiSuccess({ result, usage }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["ai.diagnostics"] },
  );
}
