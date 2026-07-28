import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";

const brandKnowledgeTestIds = {
  organisationId: "org-1",
  projectId: "project-1",
  brandId: "brand-1",
  userProfileId: "profile-1",
};

const tenantContext: TenantContext = {
  userId: "auth-user-1",
  userProfileId: brandKnowledgeTestIds.userProfileId,
  organisationId: brandKnowledgeTestIds.organisationId,
  organisationRole: OrganisationRole.OWNER,
};

const prismaMock = vi.hoisted(() => ({
  brand: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  brandAudience: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  brandPersona: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  brandOffer: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  brandMessage: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  brandVoiceRule: {
    findUnique: vi.fn(),
  },
  brandCompetitor: {
    findMany: vi.fn(),
  },
  brandAsset: {
    findMany: vi.fn(),
  },
  brandReference: {
    findMany: vi.fn(),
  },
  brandComplianceRule: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn(),
  },
}));

import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { brandService } from "@/server/services/workspace-service";

describe("brandKnowledgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(brandService.getById).mockResolvedValue({
      id: brandKnowledgeTestIds.brandId,
      organisationId: brandKnowledgeTestIds.organisationId,
      projectId: brandKnowledgeTestIds.projectId,
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
      status: "ACTIVE",
      createdByUserId: brandKnowledgeTestIds.userProfileId,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      profile: null,
    });
  });

  it("rejects cross-tenant audience updates", async () => {
    prismaMock.brandAudience.findFirst.mockResolvedValue({
      id: "audience-1",
      brandId: "other-brand",
      organisationId: brandKnowledgeTestIds.organisationId,
      archivedAt: null,
    });

    await expect(
      brandKnowledgeService.audiences.update(
        brandKnowledgeTestIds.brandId,
        brandKnowledgeTestIds.organisationId,
        "audience-1",
        { name: "Updated" },
        tenantContext,
      ),
    ).rejects.toThrow(AppError);
  });

  it("creates audiences scoped to the current brand", async () => {
    prismaMock.brandAudience.create.mockResolvedValue({
      id: "audience-1",
      brandId: brandKnowledgeTestIds.brandId,
      name: "Charity founders",
    });

    const audience = await brandKnowledgeService.audiences.create(
      brandKnowledgeTestIds.brandId,
      brandKnowledgeTestIds.organisationId,
      { name: "Charity founders" },
      tenantContext,
    );

    expect(audience.name).toBe("Charity founders");
    expect(prismaMock.brandAudience.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brand: { connect: { id: brandKnowledgeTestIds.brandId } },
          organisation: { connect: { id: brandKnowledgeTestIds.organisationId } },
          project: { connect: { id: brandKnowledgeTestIds.projectId } },
        }),
      }),
    );
  });

  it("imports knowledge using tenant scope rather than payload ownership fields", async () => {
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<void>) => {
      await callback(prismaMock);
    });

    prismaMock.brand.findFirstOrThrow.mockResolvedValue({
      name: "Test Brand",
      description: null,
      website: null,
      primaryDomain: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColour: null,
      secondaryColour: null,
      accentColour: null,
      profile: null,
    });
    prismaMock.brandAudience.findMany.mockResolvedValue([]);
    prismaMock.brandPersona.findMany.mockResolvedValue([]);
    prismaMock.brandOffer.findMany.mockResolvedValue([]);
    prismaMock.brandMessage.findUnique.mockResolvedValue(null);
    prismaMock.brandVoiceRule.findUnique.mockResolvedValue(null);
    prismaMock.brandCompetitor.findMany.mockResolvedValue([]);
    prismaMock.brandAsset.findMany.mockResolvedValue([]);
    prismaMock.brandReference.findMany.mockResolvedValue([]);
    prismaMock.brandComplianceRule.findMany.mockResolvedValue([]);

    await brandKnowledgeService.importKnowledge(
      brandKnowledgeTestIds.brandId,
      brandKnowledgeTestIds.organisationId,
      {
        version: "1.0.0",
        personas: [
          {
            id: "foreign-persona",
            organisationId: "foreign-org",
            projectId: "foreign-project",
            brandId: "foreign-brand",
            name: "Retail investor",
          },
        ],
      },
      tenantContext,
    );

    expect(prismaMock.brandPersona.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brand: { connect: { id: brandKnowledgeTestIds.brandId } },
          name: "Retail investor",
        }),
      }),
    );
  });

  it("archives audiences instead of deleting them", async () => {
    prismaMock.brandAudience.findFirst.mockResolvedValue({
      id: "audience-1",
      brandId: brandKnowledgeTestIds.brandId,
      organisationId: brandKnowledgeTestIds.organisationId,
      archivedAt: null,
    });
    prismaMock.brandAudience.update.mockResolvedValue({
      id: "audience-1",
      archivedAt: new Date(),
    });

    const audience = await brandKnowledgeService.audiences.archive(
      brandKnowledgeTestIds.brandId,
      brandKnowledgeTestIds.organisationId,
      "audience-1",
      tenantContext,
    );

    expect(audience.archivedAt).toBeInstanceOf(Date);
    expect(prismaMock.brandAudience.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { archivedAt: expect.any(Date) },
      }),
    );
  });
});
