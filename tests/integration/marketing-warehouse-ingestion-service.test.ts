import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  rawMarketingBatch: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  rawMarketingRecord: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  marketingDataSourceAccount: {
    findFirst: vi.fn(),
  },
}));

const registry = vi.hoisted(() => ({
  ensureSourceAccount: vi.fn(),
}));

const brandService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const audit = vi.hoisted(() => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/marketing-warehouse-registry-service", () => ({
  marketingWarehouseRegistryService: registry,
}));
vi.mock("@/server/services/workspace-service", () => ({ brandService }));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: audit.recordAuditEvent }));

import { marketingWarehouseIngestionService } from "@/server/services/marketing-warehouse-ingestion-service";

const context = {
  organisationId: "org-1",
  userProfileId: "user-1",
  organisationRole: "OWNER",
} as never;

describe("marketing warehouse ingestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandService.getById.mockResolvedValue({ id: "brand-1", projectId: "project-1" });
    registry.ensureSourceAccount.mockResolvedValue({
      id: "account-1",
      marketingDataSource: { provider: "MANUAL_IMPORT" },
    });
  });

  it("returns an existing batch when the idempotency key matches", async () => {
    const existing = { id: "batch-existing", status: "COMPLETED" };
    prisma.rawMarketingBatch.findUnique.mockResolvedValue(existing);

    const result = await marketingWarehouseIngestionService.createBatch(
      {
        brandId: "brand-1",
        organisationId: "org-1",
        syncType: "MANUAL",
        idempotencyKey: "batch-key-1",
      },
      context,
    );

    expect(result).toBe(existing);
    expect(prisma.rawMarketingBatch.create).not.toHaveBeenCalled();
  });

  it("deduplicates records with identical payload hashes", async () => {
    prisma.rawMarketingBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      organisationId: "org-1",
      projectId: "project-1",
      brandId: "brand-1",
      marketingDataSourceAccountId: "account-1",
      provider: "MANUAL_IMPORT",
      marketingDataSourceAccount: { marketingDataSource: { provider: "MANUAL_IMPORT" } },
    });
    prisma.rawMarketingRecord.findFirst.mockResolvedValue({ id: "existing-record" });
    prisma.rawMarketingBatch.update.mockResolvedValue({ id: "batch-1", status: "COMPLETED" });

    const payload = { clicks: 10, impressions: 100 };
    const result = await marketingWarehouseIngestionService.ingestRecords(
      "batch-1",
      [
        {
          providerRecordId: "row-1",
          recordType: "metric",
          payload,
        },
      ],
      context,
    );

    expect(result.deduped).toBe(1);
    expect(result.received).toBe(0);
    expect(prisma.rawMarketingRecord.create).not.toHaveBeenCalled();
  });

  it("rejects batches that exceed the configured max size", async () => {
    const records = Array.from({ length: 5_001 }, (_, index) => ({
      providerRecordId: `row-${index}`,
      recordType: "metric",
      payload: { clicks: index },
    }));

    prisma.rawMarketingBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      organisationId: "org-1",
      projectId: "project-1",
      brandId: "brand-1",
      marketingDataSourceAccountId: "account-1",
      provider: "MANUAL_IMPORT",
      marketingDataSourceAccount: { marketingDataSource: { provider: "MANUAL_IMPORT" } },
    });

    await expect(
      marketingWarehouseIngestionService.ingestRecords("batch-1", records, context),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
