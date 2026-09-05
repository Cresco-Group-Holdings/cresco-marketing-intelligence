import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  OrganisationRole,
  PrismaClient,
  type SocialProvider,
} from "@prisma/client";
import { encryptSecret } from "@/lib/security/encryption";

export const E2E_MANIFEST_PATH = path.join(process.cwd(), ".e2e", "tenant-manifest.json");

export type E2eRoleKey = "owner" | "admin" | "member" | "viewer";

export type E2eUserRecord = {
  authUserId: string;
  email: string;
  role: OrganisationRole;
  userProfileId: string;
};

export type E2eTenantRecord = {
  key: "tenantA" | "tenantB";
  organisationId: string;
  organisationSlug: string;
  projectId: string;
  brandId: string;
  users: Record<E2eRoleKey, E2eUserRecord>;
};

export type E2eTenantManifest = {
  seededAt: string;
  databaseUrlHost: string;
  defaultAuthUserId: string;
  tenantA: E2eTenantRecord;
  tenantB: E2eTenantRecord;
};

const prisma = new PrismaClient();

const suffix = () => randomUUID().slice(0, 8);

async function createUser(input: {
  authUserId: string;
  email: string;
  displayName: string;
}) {
  return prisma.userProfile.create({
    data: {
      authUserId: input.authUserId,
      email: input.email,
      displayName: input.displayName,
    },
  });
}

async function createMembership(input: {
  organisationId: string;
  userId: string;
  role: OrganisationRole;
}) {
  return prisma.organisationMembership.create({
    data: {
      organisationId: input.organisationId,
      userId: input.userId,
      role: input.role,
      status: "ACTIVE",
    },
  });
}

async function createWorkspaceGraph(input: {
  tenantKey: "tenantA" | "tenantB";
  roles: Array<{ key: E2eRoleKey; role: OrganisationRole; authUserId: string; email: string }>;
}) {
  const id = suffix();
  const users: Partial<Record<E2eRoleKey, E2eUserRecord>> = {};

  for (const roleSpec of input.roles) {
    const profile = await createUser({
      authUserId: roleSpec.authUserId,
      email: roleSpec.email,
      displayName: `${roleSpec.key} ${input.tenantKey}`,
    });
    users[roleSpec.key] = {
      authUserId: profile.authUserId,
      email: profile.email,
      role: roleSpec.role,
      userProfileId: profile.id,
    };
  }

  const ownerProfile = users.owner!;
  const organisation = await prisma.organisation.create({
    data: {
      name: `E2E ${input.tenantKey} ${id}`,
      slug: `e2e-${input.tenantKey}-${id}`,
      status: "ACTIVE",
      defaultTimezone: "UTC",
      createdByUserId: ownerProfile.userProfileId,
    },
  });

  for (const roleSpec of input.roles) {
    await createMembership({
      organisationId: organisation.id,
      userId: users[roleSpec.key]!.userProfileId,
      role: roleSpec.role,
    });
  }
  const project = await prisma.project.create({
    data: {
      organisationId: organisation.id,
      name: `E2E Project ${id}`,
      slug: `project-${id}`,
      createdByUserId: ownerProfile.userProfileId,
      status: "ACTIVE",
    },
  });

  const brand = await prisma.brand.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      name: `E2E Brand ${id}`,
      slug: `brand-${id}`,
      status: "ACTIVE",
      createdByUserId: ownerProfile.userProfileId,
    },
  });

  await prisma.workspacePreference.upsert({
    where: { userId: ownerProfile.userProfileId },
    update: {
      currentOrganisationId: organisation.id,
      currentProjectId: project.id,
      currentBrandId: brand.id,
      onboardingCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
      onboardingStep: "complete",
    },
    create: {
      userId: ownerProfile.userProfileId,
      currentOrganisationId: organisation.id,
      currentProjectId: project.id,
      currentBrandId: brand.id,
      onboardingCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
      onboardingStep: "complete",
    },
  });

  const provider: SocialProvider = "INSTAGRAM";
  const connection = await prisma.socialConnection.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      brandId: brand.id,
      provider,
      status: "CONNECTED",
      grantedScopes: ["instagram_manage_insights"],
      connectedByUserId: ownerProfile.userProfileId,
    },
  });
  await prisma.socialConnectionCredential.create({
    data: {
      socialConnectionId: connection.id,
      encryptionKeyVersion: 1,
      encryptedAccessToken: encryptSecret(`e2e-access-${id}`),
      encryptedRefreshToken: encryptSecret(`e2e-refresh-${id}`),
    },
  });

  return {
    key: input.tenantKey,
    organisationId: organisation.id,
    organisationSlug: organisation.slug,
    projectId: project.id,
    brandId: brand.id,
    users: users as Record<E2eRoleKey, E2eUserRecord>,
  } satisfies E2eTenantRecord;
}

export async function resetE2eDatabase() {
  const tables: string[] = await prisma
    .$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    )
    .then((rows) => rows.map((row) => `"${row.tablename}"`));
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

export async function seedE2eTenants(): Promise<E2eTenantManifest> {
  await resetE2eDatabase();

  const tenantAOwnerAuth = `e2e-tenant-a-owner-${suffix()}`;
  const tenantBOwnerAuth = `e2e-tenant-b-owner-${suffix()}`;

  const tenantA = await createWorkspaceGraph({
    tenantKey: "tenantA",
    roles: [
      {
        key: "owner",
        role: "OWNER",
        authUserId: tenantAOwnerAuth,
        email: "e2e-tenant-a-owner@example.test",
      },
      {
        key: "admin",
        role: "ADMIN",
        authUserId: `e2e-tenant-a-admin-${suffix()}`,
        email: "e2e-tenant-a-admin@example.test",
      },
      {
        key: "member",
        role: "MARKETER",
        authUserId: `e2e-tenant-a-member-${suffix()}`,
        email: "e2e-tenant-a-member@example.test",
      },
      {
        key: "viewer",
        role: "VIEWER",
        authUserId: `e2e-tenant-a-viewer-${suffix()}`,
        email: "e2e-tenant-a-viewer@example.test",
      },
    ],
  });

  const tenantB = await createWorkspaceGraph({
    tenantKey: "tenantB",
    roles: [
      {
        key: "owner",
        role: "OWNER",
        authUserId: tenantBOwnerAuth,
        email: "e2e-tenant-b-owner@example.test",
      },
      {
        key: "admin",
        role: "ADMIN",
        authUserId: `e2e-tenant-b-admin-${suffix()}`,
        email: "e2e-tenant-b-admin@example.test",
      },
      {
        key: "member",
        role: "MARKETER",
        authUserId: `e2e-tenant-b-member-${suffix()}`,
        email: "e2e-tenant-b-member@example.test",
      },
      {
        key: "viewer",
        role: "VIEWER",
        authUserId: `e2e-tenant-b-viewer-${suffix()}`,
        email: "e2e-tenant-b-viewer@example.test",
      },
    ],
  });

  const databaseUrl = process.env.DATABASE_URL ?? process.env.ANALYTICS_TEST_DATABASE_URL ?? "";
  const manifest: E2eTenantManifest = {
    seededAt: new Date().toISOString(),
    databaseUrlHost: databaseUrl.split("@").pop()?.split("/")[0] ?? "unknown",
    defaultAuthUserId: tenantA.users.owner.authUserId,
    tenantA,
    tenantB,
  };

  mkdirSync(path.dirname(E2E_MANIFEST_PATH), { recursive: true });
  writeFileSync(E2E_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  return manifest;
}

export async function disconnectE2eDatabase() {
  await prisma.$disconnect();
}
