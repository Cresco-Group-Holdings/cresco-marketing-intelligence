import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  contentTenantContext,
  contentTestIds,
} from "../helpers/content-mocks";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  contentItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  contentVariant: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  contentAsset: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  contentVersion: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  contentReview: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  contentKnowledgeReference: {
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  contentTemplate: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  contentComplianceCheck: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  contentStatusHistory: {
    create: vi.fn(),
  },
  contentActivity: {
    create: vi.fn(),
  },
  brandProfile: { findUnique: vi.fn() },
  brandMessage: { findUnique: vi.fn() },
  brandVoiceRule: { findUnique: vi.fn() },
  brandAudience: { count: vi.fn() },
  brandComplianceRule: { findMany: vi.fn() },
  organisationContentSettings: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: contentTestIds.brandId,
      projectId: contentTestIds.projectId,
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { contentStudioService } from "@/server/services/content-studio-service";

function mockStudioItem(overrides: Record<string, unknown> = {}) {
  return {
    id: contentTestIds.contentId,
    organisationId: contentTestIds.organisationId,
    projectId: contentTestIds.projectId,
    brandId: contentTestIds.brandId,
    title: "Studio content",
    studioType: "BLOG_ARTICLE",
    contentType: "ARTICLE_LINK",
    status: "DRAFT",
    version: 1,
    studioObjective: null,
    audienceSummary: null,
    contentBody: "Body text",
    primaryMessage: "Body text",
    primaryCTA: null,
    primaryChannel: null,
    contentCampaignId: null,
    campaignName: null,
    dueAt: null,
    scheduledFor: null,
    timezone: null,
    ownerUserId: contentTestIds.userProfileId,
    createdByUserId: contentTestIds.userProfileId,
    approvedByUserId: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    variants: [],
    assets: [],
    knowledgeReferences: [],
    versions: [],
    reviews: [],
    comments: [],
    complianceChecks: [],
    ...overrides,
  };
}

describe("content studio permissions", () => {
  it("allows marketers to create content", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["content.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["content.approve"])).toBe(false);
  });

  it("allows admins to approve content", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["content.approve"])).toBe(true);
  });
});

describe("contentStudioService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.brandProfile.findUnique.mockResolvedValue({ id: "profile-1" });
    prismaMock.brandMessage.findUnique.mockResolvedValue({
      prohibitedClaims: [],
      proofPoints: [],
      ctaLibrary: [],
    });
    prismaMock.brandVoiceRule.findUnique.mockResolvedValue({ prohibitedVocabulary: [] });
    prismaMock.brandAudience.count.mockResolvedValue(1);
    prismaMock.brandComplianceRule.findMany.mockResolvedValue([]);
    prismaMock.organisationContentSettings.findUnique.mockResolvedValue({
      approvalMode: "ONE_APPROVER",
      separationOfDutiesEnabled: true,
    });
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });
  });

  it("lists studio items scoped to brand", async () => {
    prismaMock.contentItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        title: "Blog post",
        studioType: "BLOG_ARTICLE",
        status: "DRAFT",
        version: 1,
        contentCampaignId: null,
        primaryChannel: null,
        dueAt: null,
        scheduledFor: null,
        updatedAt: new Date(),
        variants: [],
      },
    ]);

    const items = await contentStudioService.list(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      contentTenantContext,
    );

    expect(items).toHaveLength(1);
    expect(prismaMock.contentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: contentTestIds.organisationId,
          brandId: contentTestIds.brandId,
          studioType: { not: null },
        }),
      }),
    );
  });

  it("creates studio content with initial version", async () => {
    prismaMock.contentItem.create.mockResolvedValue({
      id: "new-item",
      title: "New blog",
      status: "IDEA",
      studioType: "BLOG_ARTICLE",
      contentCampaignId: null,
    });
    prismaMock.contentVersion.create.mockResolvedValue({});
    prismaMock.contentItem.findFirst.mockResolvedValue(mockStudioItem({ id: "new-item" }));

    const item = await contentStudioService.create(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      { title: "New blog", studioType: "BLOG_ARTICLE" },
      contentTenantContext,
    );

    expect(item.id).toBe("new-item");
    expect(prismaMock.contentVersion.create).toHaveBeenCalled();
  });

  it("rejects version conflicts on update", async () => {
    prismaMock.contentItem.findFirst.mockResolvedValue(mockStudioItem({ version: 2 }));

    await expect(
      contentStudioService.update(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        contentTestIds.contentId,
        { title: "Updated", expectedVersion: 1 },
        contentTenantContext,
      ),
    ).rejects.toThrow(/version conflict/i);
  });

  it("requires scheduled date before scheduling", async () => {
    prismaMock.contentItem.findFirst.mockResolvedValue(
      mockStudioItem({ status: "READY", scheduledFor: null }),
    );

    await expect(
      contentStudioService.transition(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        contentTestIds.contentId,
        "SCHEDULED",
        contentTenantContext,
      ),
    ).rejects.toThrow(/scheduled date is required/i);
  });

  it("archives content and sets archivedAt", async () => {
    prismaMock.contentItem.findFirst.mockResolvedValue(mockStudioItem());
    prismaMock.contentItem.update.mockResolvedValue({});

    const result = await contentStudioService.archive(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      contentTestIds.contentId,
      contentTenantContext,
    );

    expect(result.archived).toBe(true);
    expect(prismaMock.contentItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ARCHIVED" }),
      }),
    );
  });

  it("returns not found for wrong tenant", async () => {
    prismaMock.contentItem.findFirst.mockResolvedValue(null);

    await expect(
      contentStudioService.getById(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        "missing-id",
        contentTenantContext,
      ),
    ).rejects.toThrow(/not found/i);
  });
});
