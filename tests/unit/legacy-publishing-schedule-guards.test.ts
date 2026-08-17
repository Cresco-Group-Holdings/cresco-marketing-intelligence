import { beforeEach, describe, expect, it, vi } from "vitest";

const legacyPrisma = vi.hoisted(() => ({
  publishingJob: { findFirst: vi.fn(), update: vi.fn() },
  publishingAttempt: { findFirst: vi.fn(), create: vi.fn() },
  contentSchedule: { update: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: legacyPrisma }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: { readTokens: vi.fn() },
}));
vi.mock("@/lib/notifications/publishing-hooks", () => ({
  notifyPublishingFailed: vi.fn().mockResolvedValue(undefined),
  notifyPublishingSucceeded: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/services/compliance-agent-service", () => ({
  complianceAgentService: { assertPublishable: vi.fn() },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => ({
    createSignedUrl: vi.fn().mockResolvedValue({ url: "https://signed.test/media.jpg" }),
  }),
}));

import { instagramPublishingService } from "@/server/services/instagram-publishing-service";

describe("legacy instagram publishing schedule guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    legacyPrisma.publishingAttempt.findFirst.mockResolvedValue(null);
    legacyPrisma.publishingAttempt.create.mockResolvedValue({});
    legacyPrisma.publishingJob.update.mockResolvedValue({});
  });

  it("returns null for publication-backed jobs without schedule", async () => {
    legacyPrisma.publishingJob.findFirst.mockResolvedValue({
      id: "job-pub",
      publicationId: "pub-1",
      contentScheduleId: null,
      schedule: null,
      publishedMediaId: null,
      status: "QUEUED",
    });

    const result = await instagramPublishingService.process("job-pub");
    expect(result).toBeNull();
    expect(legacyPrisma.contentSchedule.update).not.toHaveBeenCalled();
  });

  it("does not update contentSchedule when failJob has no contentScheduleId", async () => {
    legacyPrisma.publishingJob.findFirst.mockResolvedValue({
      id: "job-pub",
      publicationId: "pub-1",
      contentScheduleId: null,
      schedule: {
        organisationId: "org-other",
        brandId: "brand-1",
        contentItem: { status: "APPROVED" },
        contentVariant: {
          organisationId: "org-1",
          brandId: "brand-1",
          provider: "INSTAGRAM",
          socialAccountId: "sa-1",
        },
        socialAccount: { organisationId: "org-1", brandId: "brand-1" },
      },
      publishedMediaId: null,
      organisationId: "org-1",
      brandId: "brand-1",
      status: "QUEUED",
    });

    await instagramPublishingService.process("job-pub");
    expect(legacyPrisma.contentSchedule.update).not.toHaveBeenCalled();
  });
});
