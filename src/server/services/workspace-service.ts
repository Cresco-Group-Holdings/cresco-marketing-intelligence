import {
  MembershipStatus,
  OrganisationRole,
  OrganisationStatus,
  Prisma,
  ProjectStatus,
  BrandStatus,
  InvitationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { canChangeRole } from "@/lib/tenancy/permissions";
import {
  assertOrganisationScope,
  type TenantContext,
} from "@/lib/tenancy/context";
import {
  generateInvitationToken,
  hashInvitationToken,
  isInvitationExpired,
} from "@/lib/security/invitations";
import { slugFromName } from "@/lib/utils/slug";
import { recordAuditEvent } from "@/server/services/audit-service";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { ENTITLEMENT_KEYS } from "@/lib/billing/entitlements";
import { entitlementService } from "@/server/services/entitlement-service";

const ACTIVE_MEMBERSHIP: MembershipStatus = MembershipStatus.ACTIVE;

export async function assertAtLeastOneOwnerRemains(
  organisationId: string,
  excludingMembershipId?: string,
): Promise<void> {
  const ownerCount = await prisma.organisationMembership.count({
    where: {
      organisationId,
      role: OrganisationRole.OWNER,
      status: ACTIVE_MEMBERSHIP,
      ...(excludingMembershipId ? { id: { not: excludingMembershipId } } : {}),
    },
  });

  if (ownerCount < 1) {
    throw new AppError("VALIDATION_ERROR", "At least one active owner must remain.");
  }
}

export const organisationService = {
  async listForUser(userProfileId: string) {
    return prisma.organisation.findMany({
      where: {
        status: { not: OrganisationStatus.ARCHIVED },
        archivedAt: null,
        memberships: {
          some: {
            userId: userProfileId,
            status: ACTIVE_MEMBERSHIP,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  async getById(organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);

    const organisation = await prisma.organisation.findFirst({
      where: {
        id: organisationId,
        archivedAt: null,
        status: { not: OrganisationStatus.ARCHIVED },
      },
    });

    if (!organisation) {
      throw new AppError("NOT_FOUND", "Organisation was not found.");
    }

    return organisation;
  },

  async create(
    input: {
      name: string;
      slug: string;
      legalName?: string;
      website?: string;
      industry?: string;
      countryCode?: string;
      defaultTimezone?: string;
      createDefaultProject?: { name: string; slug: string };
    },
    userProfileId: string,
    requestId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.organisation.findUnique({ where: { slug: input.slug } });
      if (existing) {
        throw new AppError("VALIDATION_ERROR", "Organisation slug is already in use.");
      }

      const organisation = await tx.organisation.create({
        data: {
          name: input.name,
          slug: input.slug,
          legalName: input.legalName || null,
          website: input.website || null,
          industry: input.industry || null,
          countryCode: input.countryCode || null,
          defaultTimezone: input.defaultTimezone || "UTC",
          createdByUserId: userProfileId,
          memberships: {
            create: {
              userId: userProfileId,
              role: OrganisationRole.OWNER,
              status: ACTIVE_MEMBERSHIP,
              joinedAt: new Date(),
            },
          },
        },
      });

      if (input.createDefaultProject) {
        await tx.project.create({
          data: {
            organisationId: organisation.id,
            name: input.createDefaultProject.name,
            slug: input.createDefaultProject.slug,
            createdByUserId: userProfileId,
            status: ProjectStatus.ACTIVE,
          },
        });
      }

      await tx.workspacePreference.upsert({
        where: { userId: userProfileId },
        update: {
          currentOrganisationId: organisation.id,
          currentProjectId: null,
          currentBrandId: null,
          onboardingStep: input.createDefaultProject ? "brand" : "project",
        },
        create: {
          userId: userProfileId,
          currentOrganisationId: organisation.id,
          onboardingStep: input.createDefaultProject ? "brand" : "project",
        },
      });

      await recordAuditEvent(
        {
          organisationId: organisation.id,
          actorUserId: userProfileId,
          action: "organisation.created",
          resourceType: "organisation",
          resourceId: organisation.id,
          requestId,
        },
        tx,
      );

      return organisation;
    });
  },

  async update(
    organisationId: string,
    input: Prisma.OrganisationUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);

    const organisation = await prisma.organisation.update({
      where: { id: organisationId },
      data: input,
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "organisation.updated",
      resourceType: "organisation",
      resourceId: organisationId,
      requestId,
    });

    return organisation;
  },

  async archive(organisationId: string, context: TenantContext, requestId?: string) {
    assertOrganisationScope(organisationId, context);

    const organisation = await prisma.organisation.update({
      where: { id: organisationId },
      data: {
        status: OrganisationStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "organisation.archived",
      resourceType: "organisation",
      resourceId: organisationId,
      requestId,
    });

    return organisation;
  },
};

export const projectService = {
  async listActive(organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);

    return prisma.project.findMany({
      where: {
        organisationId,
        archivedAt: null,
        status: { not: ProjectStatus.ARCHIVED },
      },
      orderBy: { name: "asc" },
    });
  },

  async getById(projectId: string, organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organisationId,
        archivedAt: null,
        status: { not: ProjectStatus.ARCHIVED },
      },
    });

    if (!project) {
      throw new AppError("NOT_FOUND", "Project was not found.");
    }

    return project;
  },

  async create(
    organisationId: string,
    input: {
      name: string;
      slug: string;
      description?: string;
      website?: string;
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const existing = await prisma.project.findFirst({
      where: { organisationId, slug: input.slug },
    });
    if (existing) {
      throw new AppError("VALIDATION_ERROR", "Project slug is already in use.");
    }

    const project = await prisma.project.create({
      data: {
        organisationId,
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        website: input.website || null,
        createdByUserId: context.userProfileId,
        status: ProjectStatus.ACTIVE,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: project.id,
      actorUserId: context.userProfileId,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      requestId,
    });

    return project;
  },

  async update(
    projectId: string,
    organisationId: string,
    input: Prisma.ProjectUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    await projectService.getById(projectId, organisationId, context);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: input,
    });

    await recordAuditEvent({
      organisationId,
      projectId,
      actorUserId: context.userProfileId,
      action: "project.updated",
      resourceType: "project",
      resourceId: projectId,
      requestId,
    });

    return project;
  },

  async archive(
    projectId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    await projectService.getById(projectId, organisationId, context);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId,
      actorUserId: context.userProfileId,
      action: "project.archived",
      resourceType: "project",
      resourceId: projectId,
      requestId,
    });

    return project;
  },
};

export const brandService = {
  async listForProject(organisationId: string, projectId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);

    return prisma.brand.findMany({
      where: {
        organisationId,
        projectId,
        archivedAt: null,
        status: { not: BrandStatus.ARCHIVED },
      },
      orderBy: { name: "asc" },
      include: { profile: true },
    });
  },

  async getById(brandId: string, organisationId: string, context: TenantContext, projectId?: string) {
    assertOrganisationScope(organisationId, context);

    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        organisationId,
        ...(projectId ? { projectId } : {}),
        archivedAt: null,
        status: { not: BrandStatus.ARCHIVED },
      },
      include: { profile: true },
    });

    if (!brand) {
      throw new AppError("NOT_FOUND", "Brand was not found.");
    }

    return brand;
  },

  async create(
    organisationId: string,
    projectId: string,
    input: {
      name: string;
      slug: string;
      description?: string;
      website?: string;
      primaryDomain?: string;
      logoUrl?: string;
      faviconUrl?: string;
      primaryColour?: string;
      secondaryColour?: string;
      accentColour?: string;
      status?: BrandStatus;
    },
    context: TenantContext,
    requestId?: string,
  ) {
    await projectService.getById(projectId, organisationId, context);

    await entitlementService.assert({
      workspaceId: organisationId,
      organisationId,
      entitlement: ENTITLEMENT_KEYS.BRANDS_MAX,
      requestedAmount: 1,
    });

    const existing = await prisma.brand.findFirst({
      where: { projectId, slug: input.slug },
    });
    if (existing) {
      throw new AppError("VALIDATION_ERROR", "Brand slug is already in use.");
    }

    const brand = await prisma.brand.create({
      data: {
        organisationId,
        projectId,
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        website: input.website || null,
        primaryDomain: input.primaryDomain || null,
        logoUrl: input.logoUrl || null,
        faviconUrl: input.faviconUrl || null,
        primaryColour: input.primaryColour || null,
        secondaryColour: input.secondaryColour || null,
        accentColour: input.accentColour || null,
        status: input.status ?? BrandStatus.DRAFT,
        createdByUserId: context.userProfileId,
        profile: {
          create: {
            organisationId,
            projectId,
          },
        },
      },
      include: { profile: true },
    });

    await recordAuditEvent({
      organisationId,
      projectId,
      actorUserId: context.userProfileId,
      action: "brand.created",
      resourceType: "brand",
      resourceId: brand.id,
      requestId,
    });

    return brand;
  },

  async update(
    brandId: string,
    organisationId: string,
    input: Prisma.BrandUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const existing = await brandService.getById(brandId, organisationId, context);

    const brand = await prisma.brand.update({
      where: { id: brandId },
      data: input,
      include: { profile: true },
    });

    await recordAuditEvent({
      organisationId,
      projectId: existing.projectId,
      actorUserId: context.userProfileId,
      action: "brand.updated",
      resourceType: "brand",
      resourceId: brandId,
      requestId,
    });

    return brand;
  },

  async archive(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const existing = await brandService.getById(brandId, organisationId, context);

    const brand = await prisma.brand.update({
      where: { id: brandId },
      data: {
        status: BrandStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: { profile: true },
    });

    await recordAuditEvent({
      organisationId,
      projectId: existing.projectId,
      actorUserId: context.userProfileId,
      action: "brand.archived",
      resourceType: "brand",
      resourceId: brandId,
      requestId,
    });

    return brand;
  },
};

export const brandProfileService = {
  async get(brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    if (!brand.profile) {
      throw new AppError("NOT_FOUND", "Brand profile was not found.");
    }
    return brand.profile;
  },

  async upsert(
    brandId: string,
    organisationId: string,
    input: Prisma.BrandProfileUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    const profile = await prisma.brandProfile.upsert({
      where: { brandId },
      update: input,
      create: {
        brandId,
        organisationId,
        projectId: brand.projectId,
        shortDescription: (input.shortDescription as string | null | undefined) ?? null,
        longDescription: (input.longDescription as string | null | undefined) ?? null,
        mission: (input.mission as string | null | undefined) ?? null,
        valueProposition: (input.valueProposition as string | null | undefined) ?? null,
        targetAudience: (input.targetAudience as string | null | undefined) ?? null,
        customerProblems: (input.customerProblems as string | null | undefined) ?? null,
        keyBenefits: (input.keyBenefits as string | null | undefined) ?? null,
        productsAndServices: (input.productsAndServices as string | null | undefined) ?? null,
        preferredTone: (input.preferredTone as string | null | undefined) ?? null,
        prohibitedTone: (input.prohibitedTone as string | null | undefined) ?? null,
        preferredLanguage: (input.preferredLanguage as string | null | undefined) ?? null,
        targetCountries: (input.targetCountries as string[] | undefined) ?? [],
        targetIndustries: (input.targetIndustries as string[] | undefined) ?? [],
        competitors: (input.competitors as string[] | undefined) ?? [],
        complianceNotes: (input.complianceNotes as string | null | undefined) ?? null,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "brandProfile.updated",
      resourceType: "brandProfile",
      resourceId: profile.id,
      requestId,
    });

    return profile;
  },
};

export const membershipService = {
  async list(organisationId: string) {
    return prisma.organisationMembership.findMany({
      where: { organisationId, status: { not: MembershipStatus.REMOVED } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async changeRole(
    membershipId: string,
    organisationId: string,
    role: OrganisationRole,
    context: TenantContext,
    requestId?: string,
  ) {
    const membership = await prisma.organisationMembership.findFirst({
      where: { id: membershipId, organisationId },
    });

    if (!membership) {
      throw new AppError("NOT_FOUND", "Membership was not found.");
    }

    if (!canChangeRole(context.organisationRole, membership.role, role)) {
      throw new AppError("FORBIDDEN", "You cannot change this member role.");
    }

    if (membership.role === OrganisationRole.OWNER && role !== OrganisationRole.OWNER) {
      await assertAtLeastOneOwnerRemains(organisationId, membershipId);
    }

    const updated = await prisma.organisationMembership.update({
      where: { id: membershipId },
      data: { role },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "member.roleChanged",
      resourceType: "membership",
      resourceId: membershipId,
      requestId,
      metadata: { fromRole: membership.role, toRole: role },
    });

    return updated;
  },

  async suspend(
    membershipId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const membership = await prisma.organisationMembership.findFirst({
      where: { id: membershipId, organisationId },
    });

    if (!membership) {
      throw new AppError("NOT_FOUND", "Membership was not found.");
    }

    if (membership.role === OrganisationRole.OWNER) {
      await assertAtLeastOneOwnerRemains(organisationId, membershipId);
    }

    const updated = await prisma.organisationMembership.update({
      where: { id: membershipId },
      data: { status: MembershipStatus.SUSPENDED },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "member.suspended",
      resourceType: "membership",
      resourceId: membershipId,
      requestId,
    });

    return updated;
  },

  async reactivate(
    membershipId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const updated = await prisma.organisationMembership.update({
      where: { id: membershipId },
      data: { status: ACTIVE_MEMBERSHIP },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "member.reactivated",
      resourceType: "membership",
      resourceId: membershipId,
      requestId,
    });

    return updated;
  },

  async remove(
    membershipId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const membership = await prisma.organisationMembership.findFirst({
      where: { id: membershipId, organisationId },
    });

    if (!membership) {
      throw new AppError("NOT_FOUND", "Membership was not found.");
    }

    if (membership.userId === context.userProfileId && membership.role === OrganisationRole.OWNER) {
      throw new AppError("FORBIDDEN", "The final owner cannot remove themselves.");
    }

    if (membership.role === OrganisationRole.OWNER) {
      await assertAtLeastOneOwnerRemains(organisationId, membershipId);
    }

    const updated = await prisma.organisationMembership.update({
      where: { id: membershipId },
      data: { status: MembershipStatus.REMOVED },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "member.removed",
      resourceType: "membership",
      resourceId: membershipId,
      requestId,
    });

    return updated;
  },
};

export const invitationService = {
  async list(organisationId: string) {
    return prisma.invitation.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(
    organisationId: string,
    input: { email: string; role: OrganisationRole },
    context: TenantContext,
    requestId?: string,
  ) {
    if (input.role === OrganisationRole.OWNER && context.organisationRole !== OrganisationRole.OWNER) {
      throw new AppError("FORBIDDEN", "Only owners can invite other owners.");
    }

    await entitlementService.assert({
      workspaceId: organisationId,
      organisationId,
      entitlement: ENTITLEMENT_KEYS.USERS_MAX,
      requestedAmount: 1,
    });

    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        organisationId,
        email: input.email,
        role: input.role,
        tokenHash,
        status: InvitationStatus.PENDING,
        expiresAt,
        invitedByUserId: context.userProfileId,
      },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "member.invited",
      resourceType: "invitation",
      resourceId: invitation.id,
      requestId,
      metadata: { email: input.email, role: input.role },
    });

    return { invitation, token };
  },

  async revoke(
    invitationId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const invitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "invitation.revoked",
      resourceType: "invitation",
      resourceId: invitationId,
      requestId,
    });

    return invitation;
  },

  async accept(token: string, userProfileId: string, email: string, requestId?: string) {
    const tokenHash = hashInvitationToken(token);

    return prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { tokenHash } });

      if (!invitation || invitation.status !== InvitationStatus.PENDING) {
        throw new AppError("NOT_FOUND", "Invitation is not valid.");
      }

      if (isInvitationExpired(invitation.expiresAt)) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new AppError("VALIDATION_ERROR", "Invitation has expired.");
      }

      if (invitation.email !== email.toLowerCase()) {
        throw new AppError("FORBIDDEN", "Invitation cannot be accepted for this account.");
      }

      const existingMembership = await tx.organisationMembership.findUnique({
        where: {
          organisationId_userId: {
            organisationId: invitation.organisationId,
            userId: userProfileId,
          },
        },
      });

      if (existingMembership?.status === ACTIVE_MEMBERSHIP) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: InvitationStatus.ACCEPTED,
            acceptedByUserId: userProfileId,
            acceptedAt: new Date(),
          },
        });
        return existingMembership;
      }

      const membership = await tx.organisationMembership.upsert({
        where: {
          organisationId_userId: {
            organisationId: invitation.organisationId,
            userId: userProfileId,
          },
        },
        update: {
          role: invitation.role,
          status: ACTIVE_MEMBERSHIP,
          joinedAt: new Date(),
        },
        create: {
          organisationId: invitation.organisationId,
          userId: userProfileId,
          role: invitation.role,
          status: ACTIVE_MEMBERSHIP,
          joinedAt: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedByUserId: userProfileId,
          acceptedAt: new Date(),
        },
      });

      await recordAuditEvent(
        {
          organisationId: invitation.organisationId,
          actorUserId: userProfileId,
          action: "invitation.accepted",
          resourceType: "invitation",
          resourceId: invitation.id,
          requestId,
        },
        tx,
      );

      return membership;
    });
  },
};

export const workspaceService = {
  async getResolvedWorkspace(userProfileId: string) {
    const preference = await prisma.workspacePreference.findUnique({
      where: { userId: userProfileId },
    });

    const organisations = await organisationService.listForUser(userProfileId);

    let currentOrganisationId = preference?.currentOrganisationId ?? null;
    let currentProjectId = preference?.currentProjectId ?? null;
    let currentBrandId = preference?.currentBrandId ?? null;

    if (
      !currentOrganisationId ||
      !organisations.some((organisation) => organisation.id === currentOrganisationId)
    ) {
      currentOrganisationId = organisations[0]?.id ?? null;
      currentProjectId = null;
      currentBrandId = null;
    }

    const projects = currentOrganisationId
      ? await projectService.listActive(
          currentOrganisationId,
          await buildTenantContextForUser(userProfileId, {
            organisationId: currentOrganisationId,
          }),
        )
      : [];

    if (!currentProjectId || !projects.some((project) => project.id === currentProjectId)) {
      currentProjectId = projects[0]?.id ?? null;
      currentBrandId = null;
    }

    const brands =
      currentOrganisationId && currentProjectId
        ? await brandService.listForProject(
            currentOrganisationId,
            currentProjectId,
            await buildTenantContextForUser(userProfileId, {
              organisationId: currentOrganisationId,
              projectId: currentProjectId,
            }),
          )
        : [];

    if (!currentBrandId || !brands.some((brand) => brand.id === currentBrandId)) {
      currentBrandId = brands[0]?.id ?? null;
    }

    if (
      preference &&
      (preference.currentOrganisationId !== currentOrganisationId ||
        preference.currentProjectId !== currentProjectId ||
        preference.currentBrandId !== currentBrandId)
    ) {
      await prisma.workspacePreference.update({
        where: { userId: userProfileId },
        data: {
          currentOrganisationId,
          currentProjectId,
          currentBrandId,
        },
      });
    } else if (!preference && currentOrganisationId) {
      await prisma.workspacePreference.create({
        data: {
          userId: userProfileId,
          currentOrganisationId,
          currentProjectId,
          currentBrandId,
        },
      });
    }

    return {
      organisations,
      projects,
      brands,
      preference: {
        currentOrganisationId,
        currentProjectId,
        currentBrandId,
        onboardingCompletedAt: preference?.onboardingCompletedAt ?? null,
        onboardingStep: preference?.onboardingStep ?? null,
      },
    };
  },

  async updateWorkspace(
    userProfileId: string,
    input: {
      currentOrganisationId?: string | null;
      currentProjectId?: string | null;
      currentBrandId?: string | null;
      onboardingStep?: string | null;
      completeOnboarding?: boolean;
    },
    requestId?: string,
  ) {
    const organisations = await organisationService.listForUser(userProfileId);

    const organisationId = input.currentOrganisationId ?? null;
    if (organisationId && !organisations.some((organisation) => organisation.id === organisationId)) {
      throw new AppError("FORBIDDEN", "Organisation is not accessible.");
    }

    const projectId = input.currentProjectId ?? null;
    if (organisationId && projectId) {
      const tenantContext = await buildTenantContextForUser(userProfileId, {
        organisationId,
        projectId,
      });
      await projectService.getById(projectId, organisationId, tenantContext);
    }

    const brandId = input.currentBrandId ?? null;
    if (organisationId && projectId && brandId) {
      const tenantContext = await buildTenantContextForUser(userProfileId, {
        organisationId,
        projectId,
        brandId,
      });
      await brandService.getById(brandId, organisationId, tenantContext, projectId);
    }

    const preference = await prisma.workspacePreference.upsert({
      where: { userId: userProfileId },
      update: {
        currentOrganisationId: organisationId,
        currentProjectId: projectId,
        currentBrandId: brandId,
        onboardingStep: input.onboardingStep ?? undefined,
        onboardingCompletedAt: input.completeOnboarding ? new Date() : undefined,
      },
      create: {
        userId: userProfileId,
        currentOrganisationId: organisationId,
        currentProjectId: projectId,
        currentBrandId: brandId,
        onboardingStep: input.onboardingStep ?? null,
        onboardingCompletedAt: input.completeOnboarding ? new Date() : null,
      },
    });

    if (organisationId) {
      const action = input.currentBrandId
        ? "workspace.brandChanged"
        : input.currentProjectId
          ? "workspace.projectChanged"
          : "workspace.organisationChanged";

      await recordAuditEvent({
        organisationId,
        projectId: projectId ?? undefined,
        actorUserId: userProfileId,
        action,
        resourceType: "workspace",
        resourceId: preference.id,
        requestId,
      });
    }

    return preference;
  },
};

export { slugFromName };
