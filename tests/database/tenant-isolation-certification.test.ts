import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("Task 3 tenant isolation certification", () => {
  let tenantA: Awaited<ReturnType<typeof createTenant>>;
  let tenantB: Awaited<ReturnType<typeof createTenant>>;

  beforeEach(async () => {
    await resetDatabase();
    tenantA = await createTenant();
    tenantB = await createTenant();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function tenantContext(tenant: Awaited<ReturnType<typeof createTenant>>) {
    return {
      userId: tenant.user.id,
      userProfileId: tenant.user.id,
      organisationId: tenant.organisation.id,
      organisationRole: OrganisationRole.OWNER,
      projectId: tenant.project.id,
      brandId: tenant.brand.id,
    };
  }

  it("prevents Tenant B from reading Tenant A ContentItem by ID", async () => {
    const { contentService } = await import("@/server/services/content-service");
    await expect(
      contentService.getById(
        tenantB.brand.id,
        tenantB.organisation.id,
        tenantA.contentItem.id,
        tenantContext(tenantB),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents Tenant B from reading Tenant A attribution journey", async () => {
    const journey = await prisma.attributionJourney.create({
      data: {
        organisationId: tenantA.organisation.id,
        projectId: tenantA.project.id,
        brandId: tenantA.brand.id,
        conversionType: "purchase",
        journeyStart: new Date(),
        journeyEnd: new Date(),
        status: "UNATTRIBUTED",
        lookbackWindowDays: 90,
        directTrafficPolicy: "RETAIN",
      },
    });

    const { attributionJourneyService } = await import("@/server/services/attribution-journey-service");
    await expect(
      attributionJourneyService.getJourney(
        tenantB.brand.id,
        tenantB.organisation.id,
        journey.id,
        tenantContext(tenantB),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns no Tenant A growth recommendation to Tenant B", async () => {
    const recommendation = await prisma.growthRecommendation.create({
      data: {
        organisationId: tenantA.organisation.id,
        projectId: tenantA.project.id,
        brandId: tenantA.brand.id,
        title: "Tenant A recommendation",
        description: "Private recommendation",
        status: "ACTIVE",
      },
    });

    const { growthRecommendationService } = await import(
      "@/server/services/growth-recommendation-service"
    );
    const result = await growthRecommendationService.getById(
      tenantB.brand.id,
      tenantB.organisation.id,
      recommendation.id,
      tenantContext(tenantB),
    );
    expect(result).toBeNull();
  });

  it("prevents Tenant B ID enumeration against Tenant A organisation", async () => {
    const { organisationService } = await import("@/server/services/workspace-service");
    await expect(
      organisationService.getById(tenantA.organisation.id, tenantContext(tenantB)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents Tenant B from mutating Tenant A content", async () => {
    const { contentService } = await import("@/server/services/content-service");
    await expect(
      contentService.update(
        tenantB.brand.id,
        tenantB.organisation.id,
        tenantA.contentItem.id,
        { title: "Cross-tenant mutation attempt" },
        tenantContext(tenantB),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("denies PostgREST-facing roles SELECT on Organisation when roles exist", async () => {
    const roles = await prisma.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
    `;
    if (roles.length === 0) return;

    for (const role of roles) {
      const rows = await prisma.$queryRaw<Array<{ has_priv: boolean }>>`
        SELECT has_table_privilege(
          ${role.rolname},
          'public."Organisation"',
          'SELECT'
        ) AS has_priv
      `;
      expect(rows[0]?.has_priv).toBe(false);
    }
  });
});
