import {
  BrandStatus,
  MembershipStatus,
  OnboardingStepKey,
  OrganisationRole,
  Prisma,
  ProjectStatus,
  type Brand,
  type OrganisationMembership,
  type Project,
  type UserProfile,
} from "@prisma/client";

export const onboardingTestIds = {
  userProfileId: "profile-1",
  organisationId: "org-1",
  projectId: "project-1",
  brandId: "brand-1",
  membershipId: "membership-1",
} as const;

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

export type OnboardingProgressWithUser = Prisma.OnboardingProgressGetPayload<{
  include: { user: true };
}>;

export function createMockUserProfile(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    id: onboardingTestIds.userProfileId,
    authUserId: "auth-user-1",
    email: "user@example.com",
    displayName: "Test User",
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
    timezone: "UTC",
    locale: "en-GB",
    createdAt: fixedDate,
    updatedAt: fixedDate,
    ...overrides,
  };
}

export function createMockOnboardingProgress(
  overrides: Partial<Omit<OnboardingProgressWithUser, "user">> & {
    user?: UserProfile;
  } = {},
): OnboardingProgressWithUser {
  const user = overrides.user ?? createMockUserProfile({ id: overrides.userId ?? onboardingTestIds.userProfileId });
  const { user: _user, ...scalarOverrides } = overrides;

  return {
    id: "progress-1",
    userId: onboardingTestIds.userProfileId,
    organisationId: null,
    projectId: null,
    brandId: null,
    currentStep: OnboardingStepKey.ACCOUNT_PROFILE,
    completedSteps: [],
    stepData: null,
    templateKey: null,
    completedAt: null,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    user,
    ...scalarOverrides,
  };
}

export function createMockMembership(
  overrides: Partial<OrganisationMembership> = {},
): OrganisationMembership {
  return {
    id: onboardingTestIds.membershipId,
    organisationId: onboardingTestIds.organisationId,
    userId: onboardingTestIds.userProfileId,
    role: OrganisationRole.OWNER,
    status: MembershipStatus.ACTIVE,
    joinedAt: fixedDate,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    ...overrides,
  };
}

export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: onboardingTestIds.projectId,
    organisationId: onboardingTestIds.organisationId,
    name: "Test Project",
    slug: "test-project",
    description: null,
    website: null,
    status: ProjectStatus.ACTIVE,
    createdByUserId: onboardingTestIds.userProfileId,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    archivedAt: null,
    ...overrides,
  };
}

export function createMockBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: onboardingTestIds.brandId,
    organisationId: onboardingTestIds.organisationId,
    projectId: onboardingTestIds.projectId,
    name: "Test Brand",
    slug: "test-brand",
    description: null,
    website: null,
    primaryDomain: null,
    logoUrl: null,
    faviconUrl: null,
    primaryColour: null,
    secondaryColour: null,
    accentColour: null,
    analyticsTimezone: null,
    status: BrandStatus.ACTIVE,
    createdByUserId: onboardingTestIds.userProfileId,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    archivedAt: null,
    ...overrides,
  };
}

export function applyOnboardingProgressUpdate(
  current: OnboardingProgressWithUser,
  data: Prisma.OnboardingProgressUpdateInput,
): OnboardingProgressWithUser {
  return createMockOnboardingProgress({
    ...current,
    organisationId:
      data.organisationId === undefined
        ? current.organisationId
        : (data.organisationId as string | null),
    projectId:
      data.projectId === undefined ? current.projectId : (data.projectId as string | null),
    brandId: data.brandId === undefined ? current.brandId : (data.brandId as string | null),
    currentStep:
      data.currentStep === undefined
        ? current.currentStep
        : (data.currentStep as OnboardingStepKey),
    completedSteps:
      data.completedSteps === undefined
        ? current.completedSteps
        : (data.completedSteps as OnboardingStepKey[]),
    stepData:
      data.stepData === undefined
        ? current.stepData
        : data.stepData === null
          ? null
          : (data.stepData as OnboardingProgressWithUser["stepData"]),
    templateKey:
      data.templateKey === undefined
        ? current.templateKey
        : (data.templateKey as string | null),
    completedAt:
      data.completedAt === undefined ? current.completedAt : (data.completedAt as Date | null),
    user: current.user,
  });
}

export function createInitialProgressState(): OnboardingProgressWithUser {
  return createMockOnboardingProgress();
}

type OnboardingProgressDelegate = Prisma.Prisma__OnboardingProgressClient<OnboardingProgressWithUser>;

export function createOnboardingProgressDelegate(
  progress: OnboardingProgressWithUser,
): OnboardingProgressDelegate {
  const delegate = Object.assign(Promise.resolve(progress), {
    user: () => Promise.resolve(progress.user),
  });

  return delegate as OnboardingProgressDelegate;
}
