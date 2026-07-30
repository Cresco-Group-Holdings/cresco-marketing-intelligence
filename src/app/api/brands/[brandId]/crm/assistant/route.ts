import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withLifecycleAgentApprove,
  withLifecycleAgentDraft,
  withLifecycleAgentFeedback,
  withLifecycleAgentRead,
  withLifecycleAgentRun,
  withLifecycleAgentViewHistory,
} from "@/lib/api/lifecycle-agent-handler";
import {
  lifecycleAgentService,
  type BriefType,
} from "@/server/services/lifecycle-agent-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const view = url.searchParams.get("view");
  const runId = url.searchParams.get("runId") ?? undefined;
  const recommendationId = url.searchParams.get("recommendationId") ?? undefined;
  const reviewType = url.searchParams.get("reviewType") ?? undefined;
  const includeDismissed = url.searchParams.get("includeDismissed") === "true";

  if (view === "history") {
    return withLifecycleAgentViewHistory(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        { runs: await lifecycleAgentService.listRuns(brandId, organisationId, tenant!, { reviewType }) },
        { requestId },
      ),
    );
  }

  return withLifecycleAgentRead(request, organisationId, async ({ requestId, tenant }) => {
    switch (view) {
      case "runs":
        return apiSuccess(
          { runs: await lifecycleAgentService.listRuns(brandId, organisationId, tenant!, { reviewType }) },
          { requestId },
        );

      case "run": {
        if (!runId) throw new AppError("VALIDATION_ERROR", "runId is required for run view.");
        return apiSuccess(
          { run: await lifecycleAgentService.getRun(runId, brandId, organisationId, tenant!) },
          { requestId },
        );
      }

      case "findings": {
        if (!runId) throw new AppError("VALIDATION_ERROR", "runId is required for findings view.");
        return apiSuccess(
          {
            findings: await lifecycleAgentService.listFindings(runId, brandId, organisationId, tenant!, {
              includeDismissed,
            }),
          },
          { requestId },
        );
      }

      case "recommendations": {
        if (!runId) throw new AppError("VALIDATION_ERROR", "runId is required for recommendations view.");
        return apiSuccess(
          {
            recommendations: await lifecycleAgentService.listRecommendations(
              runId,
              brandId,
              organisationId,
              tenant!,
            ),
          },
          { requestId },
        );
      }

      case "drafts": {
        if (!recommendationId) {
          throw new AppError("VALIDATION_ERROR", "recommendationId is required for drafts view.");
        }
        return apiSuccess(
          {
            drafts: await lifecycleAgentService.listDrafts(
              recommendationId,
              brandId,
              organisationId,
              tenant!,
            ),
          },
          { requestId },
        );
      }

      case "recommendation": {
        if (!recommendationId) {
          throw new AppError("VALIDATION_ERROR", "recommendationId is required for recommendation view.");
        }
        return apiSuccess(
          {
            recommendation: await lifecycleAgentService.getRecommendation(
              recommendationId,
              brandId,
              organisationId,
              tenant!,
            ),
          },
          { requestId },
        );
      }

      default:
        return apiSuccess(
          { runs: await lifecycleAgentService.listRuns(brandId, organisationId, tenant!, { reviewType }) },
          { requestId },
        );
    }
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "startRun":
      return withLifecycleAgentRun(request, organisationId, async ({ requestId, tenant }) => {
        const run = await lifecycleAgentService.startRun(brandId, organisationId, body, tenant!);
        return apiSuccess({ run }, { requestId });
      });

    case "getBrief":
      return withLifecycleAgentRead(request, organisationId, async ({ requestId, tenant }) => {
        const briefType = (body.briefType ?? "daily") as BriefType;
        const brief = await lifecycleAgentService.generateBrief(brandId, organisationId, briefType, tenant!, {
          dateRangeStart: body.dateRangeStart,
          dateRangeEnd: body.dateRangeEnd,
          scope: body.scope,
        });
        return apiSuccess({ brief }, { requestId });
      });

    case "createDraft":
      return withLifecycleAgentDraft(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.recommendationId) {
          throw new AppError("VALIDATION_ERROR", "recommendationId is required.");
        }
        const draft = await lifecycleAgentService.createDraft(
          body.recommendationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ draft }, { requestId });
      });

    case "approveAction":
      return withLifecycleAgentApprove(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.actionProposalId) {
          throw new AppError("VALIDATION_ERROR", "actionProposalId is required.");
        }
        const proposal = await lifecycleAgentService.approveAction(
          body.actionProposalId,
          brandId,
          organisationId,
          body.notes,
          tenant!,
        );
        return apiSuccess({ proposal }, { requestId });
      });

    case "rejectAction":
      return withLifecycleAgentApprove(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.actionProposalId) {
          throw new AppError("VALIDATION_ERROR", "actionProposalId is required.");
        }
        const proposal = await lifecycleAgentService.rejectAction(
          body.actionProposalId,
          brandId,
          organisationId,
          body.notes,
          tenant!,
        );
        return apiSuccess({ proposal }, { requestId });
      });

    case "submitFeedback":
      return withLifecycleAgentFeedback(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.recommendationId) {
          throw new AppError("VALIDATION_ERROR", "recommendationId is required.");
        }
        const feedback = await lifecycleAgentService.submitFeedback(
          body.recommendationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ feedback }, { requestId });
      });

    case "dismissFinding":
      return withLifecycleAgentFeedback(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.findingId) {
          throw new AppError("VALIDATION_ERROR", "findingId is required.");
        }
        const finding = await lifecycleAgentService.dismissFinding(
          body.findingId,
          brandId,
          organisationId,
          body.reason ?? body.notes,
          tenant!,
        );
        return apiSuccess({ finding }, { requestId });
      });

    case "proposeAction":
      return withLifecycleAgentRun(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.recommendationId) {
          throw new AppError("VALIDATION_ERROR", "recommendationId is required.");
        }
        const proposal = await lifecycleAgentService.proposeAction(
          body.recommendationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ proposal }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
