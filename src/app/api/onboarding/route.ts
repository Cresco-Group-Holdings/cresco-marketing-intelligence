import { NextRequest } from "next/server";
import { OnboardingStepKey } from "@prisma/client";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  accountProfileStepSchema,
  applyTemplateSchema,
  brandProfileStepSchema,
  brandStepSchema,
  channelPreferencesStepSchema,
  marketingObjectivesStepSchema,
  onboardingStepActionSchema,
  organisationStepSchema,
  projectStepSchema,
  workspaceContextStepSchema,
} from "@/lib/validation/onboarding";
import { onboardingService } from "@/server/services/onboarding-service";
import { CRESCO_INTERNAL_TEMPLATE } from "@/lib/onboarding/cresco-template";
import { resolveOnboardingStatus, serializeOnboardingStatus } from "@/lib/onboarding/status";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const [state, onboarding] = await Promise.all([
      onboardingService.getState(user.userProfileId),
      resolveOnboardingStatus(user.userProfileId),
    ]);
    return apiSuccess(
      {
        ...state,
        onboarding: serializeOnboardingStatus(onboarding),
        templates: [CRESCO_INTERNAL_TEMPLATE],
      },
      { requestId },
    );
  });
}

export async function PUT(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(onboardingStepActionSchema, await jsonBody(request));

    if (body.action === "back") {
      const progress = await onboardingService.goBack(user.userProfileId, body.step, requestId);
      const state = await onboardingService.getState(user.userProfileId);
      return apiSuccess({ progress, state }, { requestId });
    }

    let progress;
    switch (body.step) {
      case OnboardingStepKey.ACCOUNT_PROFILE:
        progress = await onboardingService.saveAccountProfile(
          user.userProfileId,
          parseBody(accountProfileStepSchema, body.data),
          requestId,
        );
        break;
      case OnboardingStepKey.ORGANISATION:
        progress = await onboardingService.saveOrganisation(
          user.userProfileId,
          parseBody(organisationStepSchema, body.data),
          requestId,
        );
        break;
      case OnboardingStepKey.PROJECT:
        progress = await onboardingService.saveProject(
          user.userProfileId,
          parseBody(projectStepSchema, body.data),
          requestId,
        );
        break;
      case OnboardingStepKey.BRAND:
        progress = await onboardingService.saveBrand(
          user.userProfileId,
          parseBody(brandStepSchema, body.data),
          requestId,
        );
        break;
      case OnboardingStepKey.BRAND_PROFILE:
        progress = await onboardingService.saveBrandProfile(
          user.userProfileId,
          parseBody(brandProfileStepSchema, body.data),
          requestId,
        );
        break;
      case OnboardingStepKey.MARKETING_OBJECTIVES:
        progress = await onboardingService.saveMarketingObjectives(
          user.userProfileId,
          parseBody(marketingObjectivesStepSchema, body.data),
          requestId,
        );
        break;
      case OnboardingStepKey.CHANNEL_PREFERENCES:
        progress = await onboardingService.saveChannelPreferences(
          user.userProfileId,
          parseBody(channelPreferencesStepSchema, body.data),
          requestId,
        );
        break;
      case OnboardingStepKey.REVIEW:
        progress = await onboardingService.complete(user.userProfileId, requestId);
        break;
      default:
        throw new AppError("VALIDATION_ERROR", "Unsupported onboarding step.");
    }

    const state = await onboardingService.getState(user.userProfileId);
    const onboarding = await resolveOnboardingStatus(user.userProfileId);
    return apiSuccess(
      {
        progress,
        state,
        onboarding: serializeOnboardingStatus(onboarding),
      },
      { requestId },
    );
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = await jsonBody<{ action?: string; templateKey?: string } & Record<string, unknown>>(request);

    if (body.action === "switch-context") {
      const input = parseBody(
        workspaceContextStepSchema.refine(
          (value) => Boolean(value.currentProjectId && value.currentBrandId),
          "Project and brand are required.",
        ),
        body,
      );
      const progress = await onboardingService.switchWorkspaceContext(
        user.userProfileId,
        {
          currentProjectId: input.currentProjectId!,
          currentBrandId: input.currentBrandId!,
        },
        requestId,
      );
      const state = await onboardingService.getState(user.userProfileId);
      return apiSuccess({ progress, state }, { requestId });
    }

    const template = parseBody(applyTemplateSchema, body);
    const progress = await onboardingService.applyCrescoTemplate(
      user.userProfileId,
      requestId,
    );
    const state = await onboardingService.getState(user.userProfileId);
    return apiSuccess({ progress, state, templateKey: template.templateKey }, { requestId });
  });
}
