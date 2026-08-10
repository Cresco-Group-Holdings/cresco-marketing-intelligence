import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole, KnowledgeEntryStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";

const testIds = {
  organisationId: "org-kb-1",
  projectId: "project-kb-1",
  brandId: "brand-kb-1",
  knowledgeBaseId: "kb-1",
  entryId: "entry-1",
  userProfileId: "profile-kb-1",
};

const tenantContext: TenantContext = {
  userId: "auth-kb-1",
  userProfileId: testIds.userProfileId,
  organisationId: testIds.organisationId,
  organisationRole: OrganisationRole.OWNER,
};

const prismaMock = vi.hoisted(() => ({
  knowledgeBase: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  knowledgeEntry: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  knowledgeEntryVersion: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  knowledgeActivity: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  knowledgeRelationship: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  contentCampaign: {
    findFirst: vi.fn(),
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

import { knowledgeBaseService } from "@/server/services/knowledge-base-service";
import { brandService } from "@/server/services/workspace-service";

describe("knowledgeBaseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(brandService.getById).mockResolvedValue({
      id: testIds.brandId,
      projectId: testIds.projectId,
    } as never);
    prismaMock.knowledgeBase.findFirst.mockResolvedValue({
      id: testIds.knowledgeBaseId,
      organisationId: testIds.organisationId,
      brandId: testIds.brandId,
      status: "ACTIVE",
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it("enforces tenant scope when loading entries", async () => {
    prismaMock.knowledgeEntry.findFirst.mockResolvedValue(null);

    await expect(
      knowledgeBaseService.entries.getById(
        testIds.brandId,
        testIds.organisationId,
        testIds.knowledgeBaseId,
        testIds.entryId,
        tenantContext,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("creates structured entry with initial version", async () => {
    prismaMock.knowledgeEntry.create.mockResolvedValue({
      id: testIds.entryId,
      title: "Mission",
      summary: null,
      content: "We help marketers.",
      type: "BRAND_GUIDELINE",
      status: "DRAFT",
      validFrom: null,
      validUntil: null,
    });
    prismaMock.knowledgeEntryVersion.create.mockResolvedValue({});
    prismaMock.knowledgeActivity.create.mockResolvedValue({});

    const entry = await knowledgeBaseService.entries.create(
      testIds.brandId,
      testIds.organisationId,
      testIds.knowledgeBaseId,
      {
        type: "BRAND_GUIDELINE",
        title: "Mission",
        content: "We help marketers.",
      },
      tenantContext,
    );

    expect(entry.id).toBe(testIds.entryId);
    expect(prismaMock.knowledgeEntryVersion.create).toHaveBeenCalled();
  });

  it("rejects update on version conflict", async () => {
    prismaMock.knowledgeEntry.findFirst.mockResolvedValue({
      id: testIds.entryId,
      version: 3,
      status: "DRAFT",
      brandId: testIds.brandId,
      knowledgeBaseId: testIds.knowledgeBaseId,
      entryTags: [],
      createdBy: { id: testIds.userProfileId },
      approvedBy: null,
    });

    await expect(
      knowledgeBaseService.entries.update(
        testIds.brandId,
        testIds.organisationId,
        testIds.knowledgeBaseId,
        testIds.entryId,
        { title: "New title", expectedVersion: 2 },
        tenantContext,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("approves only in-review entries", async () => {
    prismaMock.knowledgeEntry.findFirst.mockResolvedValue({
      id: testIds.entryId,
      version: 1,
      status: "DRAFT",
      brandId: testIds.brandId,
      knowledgeBaseId: testIds.knowledgeBaseId,
      entryTags: [],
      createdBy: { id: testIds.userProfileId },
      approvedBy: null,
    });

    await expect(
      knowledgeBaseService.entries.approve(
        testIds.brandId,
        testIds.organisationId,
        testIds.knowledgeBaseId,
        testIds.entryId,
        tenantContext,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("retrieve returns only approved, valid entries", async () => {
    const now = new Date();
    prismaMock.knowledgeEntry.findMany.mockResolvedValue([
      {
        id: "approved-valid",
        type: "APPROVED_CLAIM",
        title: "ROI guarantee",
        summary: "Proven ROI",
        content: "Customers see ROI within 90 days.",
        confidence: null,
        sourceType: "MANUAL",
        sourceReference: null,
        status: KnowledgeEntryStatus.APPROVED,
        validFrom: new Date(now.getTime() - 86_400_000),
        validUntil: new Date(now.getTime() + 86_400_000),
      },
      {
        id: "expired",
        type: "APPROVED_CLAIM",
        title: "Old claim",
        summary: null,
        content: "Expired claim text",
        confidence: null,
        sourceType: "MANUAL",
        sourceReference: null,
        status: KnowledgeEntryStatus.APPROVED,
        validFrom: null,
        validUntil: new Date(now.getTime() - 86_400_000),
      },
    ]);

    const result = await knowledgeBaseService.retrieve({
      workspaceId: testIds.organisationId,
      organisationId: testIds.organisationId,
      brandId: testIds.brandId,
      query: "ROI",
      approvedOnly: true,
      limit: 10,
    });

    expect(result.searchMode).toBe("deterministic");
    expect(result.results.some((item) => item.id === "approved-valid")).toBe(true);
    expect(result.results.some((item) => item.id === "expired")).toBe(false);
  });

  it("rejects cross-brand campaign association", async () => {
    prismaMock.contentCampaign.findFirst.mockResolvedValue(null);

    await expect(
      knowledgeBaseService.entries.create(
        testIds.brandId,
        testIds.organisationId,
        testIds.knowledgeBaseId,
        {
          type: "CAMPAIGN_CONTEXT",
          title: "Campaign brief",
          content: "Context",
          campaignId: "other-campaign",
        },
        tenantContext,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("archives and restores entries", async () => {
    prismaMock.knowledgeEntry.findFirst
      .mockResolvedValueOnce({
        id: testIds.entryId,
        version: 1,
        status: "APPROVED",
        brandId: testIds.brandId,
        knowledgeBaseId: testIds.knowledgeBaseId,
        entryTags: [],
        createdBy: { id: testIds.userProfileId },
        approvedBy: null,
      })
      .mockResolvedValueOnce({
        id: testIds.entryId,
        version: 1,
        status: "ARCHIVED",
        brandId: testIds.brandId,
        knowledgeBaseId: testIds.knowledgeBaseId,
        entryTags: [],
        createdBy: { id: testIds.userProfileId },
        approvedBy: null,
      });

    prismaMock.knowledgeEntry.update.mockResolvedValue({ id: testIds.entryId, status: "ARCHIVED" });
    prismaMock.knowledgeActivity.create.mockResolvedValue({});

    await knowledgeBaseService.entries.archive(
      testIds.brandId,
      testIds.organisationId,
      testIds.knowledgeBaseId,
      testIds.entryId,
      tenantContext,
    );

    prismaMock.knowledgeEntry.update.mockResolvedValue({ id: testIds.entryId, status: "DRAFT" });

    await knowledgeBaseService.entries.restore(
      testIds.brandId,
      testIds.organisationId,
      testIds.knowledgeBaseId,
      testIds.entryId,
      tenantContext,
    );

    expect(prismaMock.knowledgeEntry.update).toHaveBeenCalledTimes(2);
  });
});
