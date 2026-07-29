import { randomUUID } from "node:crypto";
import { PrismaClient, type SocialProvider } from "@prisma/client";
import { encryptSecret } from "@/lib/security/encryption";

export const databaseUrl = process.env.ANALYTICS_TEST_DATABASE_URL;
export const databaseSuiteEnabled = Boolean(databaseUrl);

export const prisma = new PrismaClient();

export type Tenant = Awaited<ReturnType<typeof createTenant>>;

const suffix = () => randomUUID().slice(0, 8);

/**
 * Creates a complete, isolated tenant graph: organisation, project, brand, social connection with
 * encrypted credentials, an insight-capable account, and one published content item.
 */
export async function createTenant(options?: {
  provider?: SocialProvider;
  analyticsTimezone?: string | null;
  organisationTimezone?: string | null;
  refreshToken?: string | null;
  campaignName?: string;
  contentPillar?: string;
  brandStatus?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  organisationStatus?: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  withInsightsCapability?: boolean;
}) {
  const provider = options?.provider ?? "INSTAGRAM";
  const id = suffix();

  const user = await prisma.userProfile.create({
    data: { authUserId: `auth-${id}`, email: `owner-${id}@example.test`, displayName: "Owner" },
  });
  const organisation = await prisma.organisation.create({
    data: {
      name: `Org ${id}`,
      slug: `org-${id}`,
      status: options?.organisationStatus ?? "ACTIVE",
      defaultTimezone: options?.organisationTimezone ?? "UTC",
      createdByUserId: user.id,
    },
  });
  await prisma.organisationMembership.create({
    data: { organisationId: organisation.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
  });
  const project = await prisma.project.create({
    data: {
      organisationId: organisation.id,
      name: `Project ${id}`,
      slug: `project-${id}`,
      createdByUserId: user.id,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      name: `Brand ${id}`,
      slug: `brand-${id}`,
      status: options?.brandStatus ?? "ACTIVE",
      analyticsTimezone: options?.analyticsTimezone ?? null,
      createdByUserId: user.id,
    },
  });

  const connection = await prisma.socialConnection.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      brandId: brand.id,
      provider,
      status: "CONNECTED",
      grantedScopes: ["instagram_manage_insights"],
      connectedByUserId: user.id,
    },
  });
  await prisma.socialConnectionCredential.create({
    data: {
      socialConnectionId: connection.id,
      encryptionKeyVersion: 1,
      encryptedAccessToken: encryptSecret("provider-access-token"),
      encryptedRefreshToken:
        options?.refreshToken === null ? null : encryptSecret(options?.refreshToken ?? "provider-refresh-token"),
    },
  });

  const account = await prisma.socialAccount.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      brandId: brand.id,
      socialConnectionId: connection.id,
      provider,
      providerAccountId: `provider-account-${id}`,
      accountType: provider === "INSTAGRAM" ? "INSTAGRAM_BUSINESS" : "FACEBOOK_PAGE",
      status: "CONNECTED",
    },
  });
  if (options?.withInsightsCapability !== false) {
    await prisma.socialAccountCapability.create({
      data: { socialAccountId: account.id, capability: "READ_INSIGHTS" },
    });
  }

  const contentItem = await prisma.contentItem.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      brandId: brand.id,
      title: `Launch post ${id}`,
      campaignName: options?.campaignName ?? "Summer launch",
      contentPillar: options?.contentPillar ?? "Education",
      contentType: "IMAGE_POST",
      primaryCTA: "Learn more",
      destinationUrl: "https://example.test/launch",
      status: "PUBLISHED",
      ownerUserId: user.id,
      createdByUserId: user.id,
    },
  });
  const contentVariant = await prisma.contentVariant.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      brandId: brand.id,
      contentItemId: contentItem.id,
      provider,
      socialAccountId: account.id,
      format: "IMAGE_POST",
      caption: "Launch caption",
      status: "PUBLISHED",
    },
  });
  const schedule = await prisma.contentSchedule.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      brandId: brand.id,
      contentItemId: contentItem.id,
      contentVariantId: contentVariant.id,
      socialAccountId: account.id,
      scheduledFor: new Date("2026-07-10T10:00:00Z"),
      timezone: "UTC",
      status: "COMPLETED",
      createdByUserId: user.id,
    },
  });
  const publishingJob = await prisma.publishingJob.create({
    data: {
      organisationId: organisation.id,
      projectId: project.id,
      brandId: brand.id,
      contentScheduleId: schedule.id,
      idempotencyKey: `publish-${id}`,
      status: "COMPLETED",
      publishedMediaId: `provider-post-${id}`,
      permalink: `https://provider.test/${id}`,
    },
  });

  return {
    id,
    user,
    organisation,
    project,
    brand,
    connection,
    account,
    contentItem,
    contentVariant,
    schedule,
    publishingJob,
    providerPostId: publishingJob.publishedMediaId as string,
    context: {
      userId: user.authUserId,
      userProfileId: user.id,
      organisationId: organisation.id,
      organisationRole: "OWNER" as const,
      projectId: project.id,
      brandId: brand.id,
    },
  };
}

/** Truncates every table the analytics suite touches, leaving the schema in place. */
export async function resetDatabase() {
  const tables: string[] = await prisma
    .$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    )
    .then((rows) => rows.map((row) => `"${row.tablename}"`));
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

/** Builds a fetch stub that answers each provider URL pattern in order of registration. */
export function providerTransport(
  routes: Array<{ match: RegExp; status?: number; body: unknown; once?: boolean }>,
) {
  const consumed = new Set<number>();
  const calls: string[] = [];
  const stub = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    for (const [index, route] of routes.entries()) {
      if (consumed.has(index) || !route.match.test(url)) continue;
      if (route.once) consumed.add(index);
      return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
    }
    return new Response(JSON.stringify({ error: `unmatched: ${url}` }), { status: 404 });
  };
  return { stub, calls };
}
