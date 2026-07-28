import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { hasMinimumRole } from "@/lib/tenancy/roles";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AppError("UNAUTHORIZED", "Authentication is required.");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    throw new AppError("UNAUTHORIZED", "User profile is not provisioned.");
  }

  return {
    userId: user.id,
    email: profile.email,
    userProfileId: profile.id,
  };
}

export async function requireOrganisationMembership(
  organisationId: string,
  user?: AuthenticatedUser,
): Promise<{ organisationId: string; role: OrganisationRole }> {
  const authenticatedUser = user ?? (await requireAuthenticatedUser());
  const membership = await prisma.organisationMembership.findFirst({
    where: {
      organisationId,
      userProfileId: authenticatedUser.userProfileId,
      organisation: { archivedAt: null },
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

  return membership;
}

export async function requireOrganisationRole(
  organisationId: string,
  requiredRole: OrganisationRole,
  user?: AuthenticatedUser,
): Promise<{ organisationId: string; role: OrganisationRole }> {
  const membership = await requireOrganisationMembership(organisationId, user);

  if (!hasMinimumRole(membership.role, requiredRole)) {
    throw new AppError("INSUFFICIENT_ROLE", "You do not have permission for this action.");
  }

  return membership;
}

export async function buildTenantContext(input: {
  organisationId: string;
  projectId?: string;
}): Promise<TenantContext> {
  const user = await requireAuthenticatedUser();
  const membership = await requireOrganisationMembership(input.organisationId, user);

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organisationId: input.organisationId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!project) {
      throw new AppError("NOT_FOUND", "Project was not found in this organisation.");
    }
  }

  return {
    userId: user.userId,
    userProfileId: user.userProfileId,
    organisationId: membership.organisationId,
    organisationRole: membership.role,
    projectId: input.projectId,
  };
}

export async function withTenantContext<T>(
  input: { organisationId: string; projectId?: string },
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
