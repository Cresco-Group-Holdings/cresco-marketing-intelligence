import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withLeadScoringActivate,
  withLeadScoringAnalytics,
  withLeadScoringApprove,
  withLeadScoringCreate,
  withLeadScoringEdit,
  withLeadScoringOverride,
  withLeadScoringRead,
  withLeadScoringSimulate,
} from "@/lib/api/lead-scoring-handler";
import { leadQualificationModelService } from "@/server/services/lead-qualification-model-service";
import { leadScoringService } from "@/server/services/lead-scoring-service";
import { leadScoringSimulationService } from "@/server/services/lead-scoring-simulation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const modelId = url.searchParams.get("modelId");
  const view = url.searchParams.get("view");

  if (view === "qualificationModels") {
    return withLeadScoringRead(request, organisationId, async ({ requestId, tenant }) => {
      const qualificationModels = await leadQualificationModelService.listQualificationModels(
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ qualificationModels }, { requestId });
    });
  }

  const qualificationModelId = url.searchParams.get("qualificationModelId");
  if (qualificationModelId && view === "qualificationResult") {
    const leadId = url.searchParams.get("leadId");
    if (!leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
    return withLeadScoringRead(request, organisationId, async ({ requestId, tenant }) => {
      const result = await leadQualificationModelService.getQualificationResult(
        qualificationModelId,
        brandId,
        organisationId,
        leadId,
        tenant!,
      );
      return apiSuccess({ result }, { requestId });
    });
  }

  if (qualificationModelId) {
    return withLeadScoringRead(request, organisationId, async ({ requestId, tenant }) => {
      const qualificationModel = await leadQualificationModelService.getQualificationModel(
        qualificationModelId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ qualificationModel }, { requestId });
    });
  }

  const simulationId = url.searchParams.get("simulationId");
  if (simulationId && modelId) {
    return withLeadScoringSimulate(request, organisationId, async ({ requestId, tenant }) => {
      const simulation = await leadScoringSimulationService.getSimulation(
        simulationId,
        modelId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ simulation }, { requestId });
    });
  }

  if (modelId && view === "snapshots") {
    return withLeadScoringRead(request, organisationId, async ({ requestId, tenant }) => {
      const leadId = url.searchParams.get("leadId") ?? undefined;
      const snapshots = await leadScoringService.listSnapshots(
        modelId,
        brandId,
        organisationId,
        tenant!,
        { leadId },
      );
      return apiSuccess({ snapshots }, { requestId });
    });
  }

  if (modelId && view === "explanation") {
    const leadId = url.searchParams.get("leadId");
    if (!leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
    return withLeadScoringRead(request, organisationId, async ({ requestId, tenant }) => {
      const explanation = await leadScoringService.getLeadScoreExplanation(
        modelId,
        brandId,
        organisationId,
        { leadId, versionId: url.searchParams.get("versionId") ?? undefined },
        tenant!,
      );
      return apiSuccess({ explanation }, { requestId });
    });
  }

  if (modelId && view === "analytics") {
    return withLeadScoringAnalytics(request, organisationId, async ({ requestId, tenant }) => {
      const snapshots = await leadScoringService.listSnapshots(
        modelId,
        brandId,
        organisationId,
        tenant!,
        { limit: 200 },
      );
      return apiSuccess({ analytics: { snapshots } }, { requestId });
    });
  }

  if (modelId) {
    return withLeadScoringRead(request, organisationId, async ({ requestId, tenant }) => {
      const model = await leadScoringService.getModel(modelId, brandId, organisationId, tenant!);
      return apiSuccess({ model }, { requestId });
    });
  }

  return withLeadScoringRead(request, organisationId, async ({ requestId, tenant }) => {
    const models = await leadScoringService.listModels(brandId, organisationId, tenant!);
    return apiSuccess({ models }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createModel":
      return withLeadScoringCreate(request, organisationId, async ({ requestId, tenant }) => {
        const model = await leadScoringService.createModel(brandId, organisationId, body, tenant!);
        return apiSuccess({ model }, { requestId });
      });

    case "updateModel":
      return withLeadScoringEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        const model = await leadScoringService.updateModel(
          body.modelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ model }, { requestId });
      });

    case "saveRules":
      return withLeadScoringEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        const version = await leadScoringService.saveRules(
          body.modelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ version }, { requestId });
      });

    case "submitForReview":
      return withLeadScoringEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        const model = await leadScoringService.submitForReview(
          body.modelId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ model }, { requestId });
      });

    case "approveVersion":
      return withLeadScoringApprove(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        const model = await leadScoringService.approveVersion(
          body.modelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ model }, { requestId });
      });

    case "activateVersion":
      return withLeadScoringActivate(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        const model = await leadScoringService.activateVersion(
          body.modelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ model }, { requestId });
      });

    case "scoreLead":
      return withLeadScoringEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        if (!body.leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
        const snapshot = await leadScoringService.scoreLead(
          body.modelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ snapshot }, { requestId });
      });

    case "createQualificationModel":
      return withLeadScoringCreate(request, organisationId, async ({ requestId, tenant }) => {
        const qualificationModel = await leadQualificationModelService.createQualificationModel(
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ qualificationModel }, { requestId });
      });

    case "updateQualificationModel":
      return withLeadScoringEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.qualificationModelId) {
          throw new AppError("VALIDATION_ERROR", "qualificationModelId is required.");
        }
        const qualificationModel = await leadQualificationModelService.updateQualificationModel(
          body.qualificationModelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ qualificationModel }, { requestId });
      });

    case "deleteQualificationModel":
      return withLeadScoringEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.qualificationModelId) {
          throw new AppError("VALIDATION_ERROR", "qualificationModelId is required.");
        }
        const qualificationModel = await leadQualificationModelService.deleteQualificationModel(
          body.qualificationModelId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ qualificationModel }, { requestId });
      });

    case "computeQualification":
      return withLeadScoringEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.qualificationModelId) {
          throw new AppError("VALIDATION_ERROR", "qualificationModelId is required.");
        }
        if (!body.leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
        const result = await leadQualificationModelService.computeQualification(
          body.qualificationModelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ result }, { requestId });
      });

    case "applyOverride":
      return withLeadScoringOverride(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.qualificationModelId) {
          throw new AppError("VALIDATION_ERROR", "qualificationModelId is required.");
        }
        if (!body.leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
        if (!body.newStatus) throw new AppError("VALIDATION_ERROR", "newStatus is required.");
        const result = await leadQualificationModelService.applyOverride(
          body.qualificationModelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ result }, { requestId });
      });

    case "runSimulation":
      return withLeadScoringSimulate(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        const simulation = await leadScoringSimulationService.runSimulation(
          body.modelId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ simulation }, { requestId });
      });

    case "approveSimulation":
      return withLeadScoringApprove(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.modelId) throw new AppError("VALIDATION_ERROR", "modelId is required.");
        if (!body.simulationId) throw new AppError("VALIDATION_ERROR", "simulationId is required.");
        const simulation = await leadScoringSimulationService.approveSimulation(
          body.simulationId,
          body.modelId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ simulation }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
