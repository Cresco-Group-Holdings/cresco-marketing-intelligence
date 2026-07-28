import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SEED !== "true") {
    throw new Error("Development seed cannot run in production without ALLOW_DEV_SEED=true.");
  }

  const authUserId = process.env.SEED_AUTH_USER_ID;
  if (!authUserId) {
    throw new Error("SEED_AUTH_USER_ID is required.");
  }

  const email = process.env.SEED_AUTH_EMAIL ?? "owner@cresco.group";

  const user = await prisma.userProfile.upsert({
    where: { authUserId },
    update: { email },
    create: {
      authUserId,
      email,
      displayName: "Cresco Owner",
      firstName: "Cresco",
      lastName: "Owner",
    },
  });

  const organisation = await prisma.organisation.upsert({
    where: { slug: "cresco-group" },
    update: {},
    create: {
      name: "Cresco Group",
      slug: "cresco-group",
      createdByUserId: user.id,
      memberships: {
        create: {
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      },
    },
  });

  const projects = [
    { name: "Cresco Grants Intelligence", slug: "cresco-grants-intelligence" },
    { name: "Capital Cresco Terminal", slug: "capital-cresco-terminal" },
  ];

  for (const projectInput of projects) {
    const project = await prisma.project.upsert({
      where: {
        organisationId_slug: {
          organisationId: organisation.id,
          slug: projectInput.slug,
        },
      },
      update: {},
      create: {
        organisationId: organisation.id,
        name: projectInput.name,
        slug: projectInput.slug,
        createdByUserId: user.id,
        status: "ACTIVE",
      },
    });

    await prisma.brand.upsert({
      where: {
        projectId_slug: {
          projectId: project.id,
          slug: projectInput.slug,
        },
      },
      update: {},
      create: {
        organisationId: organisation.id,
        projectId: project.id,
        name: projectInput.name,
        slug: projectInput.slug,
        createdByUserId: user.id,
        status: "ACTIVE",
        profile: {
          create: {
            organisationId: organisation.id,
            projectId: project.id,
            shortDescription: `${projectInput.name} brand profile seed.`,
          },
        },
      },
    });
  }

  const firstProject = await prisma.project.findFirst({
    where: { organisationId: organisation.id, slug: "cresco-grants-intelligence" },
  });
  const firstBrand = await prisma.brand.findFirst({
    where: { organisationId: organisation.id, slug: "cresco-grants-intelligence" },
  });

  await prisma.workspacePreference.upsert({
    where: { userId: user.id },
    update: {
      currentOrganisationId: organisation.id,
      currentProjectId: firstProject?.id,
      currentBrandId: firstBrand?.id,
      onboardingCompletedAt: new Date(),
    },
    create: {
      userId: user.id,
      currentOrganisationId: organisation.id,
      currentProjectId: firstProject?.id,
      currentBrandId: firstBrand?.id,
      onboardingCompletedAt: new Date(),
    },
  });

  console.log("Development seed completed for Cresco Group.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
