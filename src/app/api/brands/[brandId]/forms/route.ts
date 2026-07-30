import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withFormsCreate,
  withFormsEdit,
  withFormsPublish,
  withFormsRead,
  withFormsViewSubmissions,
} from "@/lib/api/forms-handler";
import { leadCaptureFormService } from "@/server/services/lead-capture-form-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const formId = url.searchParams.get("formId");
  const view = url.searchParams.get("view");

  if (view === "submissions" && formId) {
    return withFormsViewSubmissions(request, organisationId, async ({ requestId, tenant }) => {
      const submissions = await leadCaptureFormService.listSubmissions(formId, brandId, organisationId, tenant!);
      return apiSuccess({ submissions }, { requestId });
    });
  }

  if (view === "analytics" && formId) {
    return withFormsRead(request, organisationId, async ({ requestId, tenant }) => {
      const analytics = await leadCaptureFormService.getAnalytics(formId, brandId, organisationId, tenant!);
      return apiSuccess({ analytics }, { requestId });
    });
  }

  if (formId) {
    return withFormsRead(request, organisationId, async ({ requestId, tenant }) => {
      const form = await leadCaptureFormService.getForm(formId, brandId, organisationId, tenant!);
      return apiSuccess({ form }, { requestId });
    });
  }

  return withFormsRead(request, organisationId, async ({ requestId, tenant }) => {
    const forms = await leadCaptureFormService.listForms(brandId, organisationId, tenant!);
    return apiSuccess({ forms }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createForm":
      return withFormsCreate(request, organisationId, async ({ requestId, tenant }) => {
        const form = await leadCaptureFormService.createForm(brandId, organisationId, body, tenant!);
        return apiSuccess({ form }, { requestId });
      });

    case "addField":
      return withFormsEdit(request, organisationId, async ({ requestId, tenant }) => {
        const field = await leadCaptureFormService.addField(
          body.formId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ field }, { requestId });
      });

    case "publishForm":
      return withFormsPublish(request, organisationId, async ({ requestId, tenant }) => {
        const form = await leadCaptureFormService.publishForm(body.formId, brandId, organisationId, tenant!);
        return apiSuccess({ form }, { requestId });
      });

    case "createVersion":
      return withFormsEdit(request, organisationId, async ({ requestId, tenant }) => {
        const version = await leadCaptureFormService.createVersion(body.formId, brandId, organisationId, tenant!);
        return apiSuccess({ version }, { requestId });
      });

    case "addThankYouAction":
      return withFormsEdit(request, organisationId, async ({ requestId, tenant }) => {
        const action = await leadCaptureFormService.addThankYouAction(
          body.formId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ action }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
