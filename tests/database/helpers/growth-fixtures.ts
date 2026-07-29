import { randomUUID } from "node:crypto";
import { prisma, type Tenant } from "./analytics-fixtures";

export async function seedGrowthMetrics(
  tenant: Tenant,
  posts: Array<{
    providerPostId: string;
    contentItemId: string;
    provider?: "INSTAGRAM";
    publishedAt: Date;
    metrics: Record<string, number>;
    topic?: string;
    offerId?: string;
  }>,
) {
  for (const post of posts) {
    await prisma.contentProvenance.upsert({
      where: { contentItemId: post.contentItemId },
      create: {
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        brandId: tenant.brand.id,
        contentItemId: post.contentItemId,
        metadata: {
          hook: "Strong opening",
          topic: post.topic ?? "Grant readiness",
          offerId: post.offerId,
        },
      },
      update: {
        metadata: {
          hook: "Strong opening",
          topic: post.topic ?? "Grant readiness",
          offerId: post.offerId,
        },
      },
    });

    for (const [metricType, metricValue] of Object.entries(post.metrics)) {
      await prisma.socialPostMetric.create({
        data: {
          organisationId: tenant.organisation.id,
          projectId: tenant.project.id,
          brandId: tenant.brand.id,
          socialAccountId: tenant.account.id,
          contentItemId: post.contentItemId,
          provider: post.provider ?? "INSTAGRAM",
          providerPostId: post.providerPostId,
          providerPublishedAt: post.publishedAt,
          metricType,
          metricValue,
          measuredAt: post.publishedAt,
          metricPeriod: "LIFETIME",
        },
      });
    }
  }
}

export async function createGrowthOffer(tenant: Tenant, name = "Starter plan") {
  return prisma.brandOffer.create({
    data: {
      organisationId: tenant.organisation.id,
      projectId: tenant.project.id,
      brandId: tenant.brand.id,
      name,
      shortDescription: "Entry offer",
    },
  });
}

export function growthAnalysisFilters(days = 30) {
  const to = new Date("2026-07-31T23:59:59.999Z");
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from, to };
}

export function uniqueRunSuffix() {
  return randomUUID().slice(0, 8);
}
