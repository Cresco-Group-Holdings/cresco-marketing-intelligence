import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  contentTenantContext,
  contentTestIds,
  createMockContentItem,
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
  contentRevision: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  contentApproval: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  contentComment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  contentComplianceCheck: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  contentStatusHistory: {
    create: vi.fn(),
  },
  organisationContentSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  brandComplianceRule: {
    findMany: vi.fn(),
  },
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

import { contentService } from "@/server/services/content-service";

describe("content permissions", () => {
  it("allows marketers to create and submit content", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["content.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["content.submitForReview"])).toBe(
      true,
    );
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["content.approve"])).toBe(false);
  });

  it("allows admins to approve content", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["content.approve"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["content.edit"])).toBe(false);
  });
});

describe("contentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.organisationContentSettings.findUnique.mockResolvedValue({
      approvalMode: "ONE_APPROVER",
      separationOfDutiesEnabled: true,
    });
    prismaMock.brandComplianceRule.findMany.mockResolvedValue([]);
    prismaMock.contentRevision.findFirst.mockResolvedValue(null);
    prismaMock.contentRevision.create.mockResolvedValue({});
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

  it("creates content without exposing restricted fields", async () => {
    prismaMock.contentItem.create.mockResolvedValue({
      id: contentTestIds.contentId,
      title: "Test",
      status: "IDEA",
      contentType: "TEXT_POST",
    });
    prismaMock.contentItem.findFirst.mockResolvedValue(
      createMockContentItem({
        title: "Cresco Grants launch",
        variants: [],
        assets: [],
        provenance: { createdManually: true },
        comments: [],
        complianceChecks: [],
        approvals: [],
      }),
    );

    const item = await contentService.create(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      {
        title: "Cresco Grants launch",
        contentType: "TEXT_POST",
        primaryMessage: "Find UK funding opportunities",
      },
      contentTenantContext,
    );

    expect(item.title).toBe("Cresco Grants launch");
    expect(item.status).toBe("DRAFT");
  });

  it("rejects approval by content creator when separation of duties is enabled", async () => {
    prismaMock.contentItem.findFirst.mockResolvedValue(
      createMockContentItem({
        status: "IN_REVIEW",
        createdByUserId: contentTestIds.userProfileId,
        ownerUserId: contentTestIds.userProfileId,
        variants: [],
        assets: [],
        provenance: null,
        comments: [],
        complianceChecks: [],
        approvals: [],
      }),
    );
    prismaMock.contentComplianceCheck.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      contentService.approve(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        contentTestIds.contentId,
        contentTenantContext,
      ),
    ).rejects.toThrow(/cannot approve their own content/i);
  });

  it("creates revisions on update", async () => {
    prismaMock.contentItem.findFirst
      .mockResolvedValueOnce(
        createMockContentItem({
          status: "DRAFT",
          variants: [],
          assets: [],
          provenance: null,
          comments: [],
          complianceChecks: [],
          approvals: [],
        }),
      )
      .mockResolvedValueOnce(
        createMockContentItem({
          status: "DRAFT",
          title: "Updated title",
          variants: [],
          assets: [],
          provenance: null,
          comments: [],
          complianceChecks: [],
          approvals: [],
        }),
      );
    prismaMock.contentItem.update.mockResolvedValue({});
    prismaMock.contentComplianceCheck.deleteMany.mockResolvedValue({ count: 0 });

    await contentService.update(
      contentTestIds.brandId,
      contentTestIds.organisationId,
      contentTestIds.contentId,
      { title: "Updated title" },
      contentTenantContext,
    );

    expect(prismaMock.contentRevision.create).toHaveBeenCalled();
  });

  it("blocks submit for review when compliance fails", async () => {
    prismaMock.contentItem.findFirst.mockResolvedValue(
      createMockContentItem({
        status: "DRAFT",
        contentType: "ARTICLE_LINK",
        destinationUrl: null,
        variants: [],
        assets: [],
        provenance: null,
        comments: [],
        complianceChecks: [],
        approvals: [],
      }),
    );
    prismaMock.contentComplianceCheck.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.contentComplianceCheck.createMany.mockResolvedValue({ count: 1 });

    await expect(
      contentService.submitForReview(
        contentTestIds.brandId,
        contentTestIds.organisationId,
        contentTestIds.contentId,
        contentTenantContext,
      ),
    ).rejects.toThrow(/compliance/i);
  });
});
