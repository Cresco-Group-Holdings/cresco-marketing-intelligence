import { MembershipStatus, OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { hasMinimumRole } from "@/lib/tenancy/roles";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { ensureUserProfile, extractProviderMetadata } from "@/lib/auth/provisioning";
import { prisma } from "@/lib/database/prisma";
import {
  getCurrentOrganisationContext,
  runWithTenantContext,
  type TenantContext,
} from "@/lib/tenancy/context";

export type AuthenticatedUser = {
  userId: string;
  email: string;
  userProfileId: string;
};

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  if (process.env.ALLOW_TEST_AUTH === "true" && process.env.TEST_AUTH_USER_ID) {
    const provisioned = await ensureUserProfile({
      authUserId: process.env.TEST_AUTH_USER_ID,
      email: process.env.TEST_AUTH_EMAIL ?? "test@example.com",
      displayName: "Test User",
    });
    return {
      userId: provisioned.authUserId,
      email: provisioned.email,
      userProfileId: provisioned.userProfileId,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new AppError("UNAUTHORIZED", "Authentication is required.");
  }

  const metadata = extractProviderMetadata(user.user_metadata);
  const provisioned = await ensureUserProfile({
    authUserId: user.id,
    email: user.email,
    ...metadata,
  });

  return {
    userId: provisioned.authUserId,
    email: provisioned.email,
    userProfileId: provisioned.userProfileId,
  };
}

export async function requireOrganisationMembership(
  organisationId: string,
  user?: AuthenticatedUser,
): Promise<{ organisationId: string; role: OrganisationRole; membershipId: string }> {
  const authenticatedUser = user ?? (await requireAuthenticatedUser());
  const membership = await prisma.organisationMembership.findFirst({
    where: {
      organisationId,
      userId: authenticatedUser.userProfileId,
      status: MembershipStatus.ACTIVE,
      organisation: {
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
    },
    select: {
      id: true,
      organisationId: true,
      role: true,
    },
  });

  if (!membership) {
    throw new AppError(
      "ORGANISATION_MEMBERSHIP_REQUIRED",
      "You do not have access to this organisation.",
    );
  }

  return {
    organisationId: membership.organisationId,
    role: membership.role,
    membershipId: membership.id,
  };
}

export async function requireOrganisationRole(
  organisationId: string,
  requiredRole: OrganisationRole,
  user?: AuthenticatedUser,
): Promise<{ organisationId: string; role: OrganisationRole; membershipId: string }> {
  const membership = await requireOrganisationMembership(organisationId, user);

  if (!hasMinimumRole(membership.role, requiredRole)) {
    throw new AppError("INSUFFICIENT_ROLE", "You do not have permission for this action.");
  }

  return membership;
}

export async function buildTenantContextForUser(
  userProfileId: string,
  input: {
    organisationId: string;
    projectId?: string;
    brandId?: string;
    authUserId?: string;
  },
): Promise<TenantContext> {
  const membership = await prisma.organisationMembership.findFirst({
    where: {
      organisationId: input.organisationId,
      userId: userProfileId,
      status: MembershipStatus.ACTIVE,
      organisation: {
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
    },
    select: {
      organisationId: true,
      role: true,
    },
  });

  if (!membership) {
    throw new AppError(
      "ORGANISATION_MEMBERSHIP_REQUIRED",
      "You do not have access to this organisation.",
    );
  }

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organisationId: input.organisationId,
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    });

    if (!project) {
      throw new AppError("NOT_FOUND", "Project was not found in this organisation.");
    }
  }

  if (input.brandId) {
    const brand = await prisma.brand.findFirst({
      where: {
        id: input.brandId,
        organisationId: input.organisationId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    });

    if (!brand) {
      throw new AppError("NOT_FOUND", "Brand was not found in this organisation.");
    }
  }

  return {
    userId: input.authUserId ?? userProfileId,
    userProfileId,
    organisationId: membership.organisationId,
    organisationRole: membership.role,
    projectId: input.projectId,
    brandId: input.brandId,
  };
}

export async function buildTenantContext(input: {
  organisationId: string;
  projectId?: string;
  brandId?: string;
}): Promise<TenantContext> {
  const user = await requireAuthenticatedUser();
  const membership = await requireOrganisationMembership(input.organisationId, user);

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organisationId: input.organisationId,
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    });

    if (!project) {
      throw new AppError("NOT_FOUND", "Project was not found in this organisation.");
    }
  }

  if (input.brandId) {
    const brand = await prisma.brand.findFirst({
      where: {
        id: input.brandId,
        organisationId: input.organisationId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
      select: { id: true, projectId: true },
    });

    if (!brand) {
      throw new AppError("NOT_FOUND", "Brand was not found in this organisation.");
    }
  }

  return {
    userId: user.userId,
    userProfileId: user.userProfileId,
    organisationId: membership.organisationId,
    organisationRole: membership.role,
    projectId: input.projectId,
    brandId: input.brandId,
  };
}

export async function withTenantContext<T>(
  input: { organisationId: string; projectId?: string; brandId?: string },
  callback: () => Promise<T> | T,
): Promise<T> {
  const context = await buildTenantContext(input);
  return runWithTenantContext(context, callback);
}

export function getOrganisationContextFromRequest(
  organisationId: string | null | undefined,
): string {
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  const activeContext = getCurrentOrganisationContext();
  if (activeContext && activeContext.organisationId !== organisationId) {
    throw new AppError("FORBIDDEN", "Organisation context mismatch.");
  }

  return organisationId;
}
