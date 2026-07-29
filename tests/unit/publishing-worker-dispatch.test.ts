import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ publishingJob: { findUnique: vi.fn() } }));
const instagramMock = vi.hoisted(() => vi.fn());
const tiktokMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/instagram-publishing-service", () => ({
  instagramPublishingService: { process: instagramMock },
}));
vi.mock("@/server/services/tiktok-publishing-service", () => ({
  tikTokPublishingService: { process: tiktokMock },
}));

import { processPublishingJob } from "@/server/services/publishing-worker";

function jobForProvider(provider: string) {
  return { schedule: { contentVariant: { provider } } };
}

describe("processPublishingJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes Instagram jobs to the Instagram service", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue(jobForProvider("INSTAGRAM"));
    instagramMock.mockResolvedValue({ state: "PUBLISHED" });

    await processPublishingJob("job-1");

    expect(instagramMock).toHaveBeenCalledWith("job-1");
    expect(tiktokMock).not.toHaveBeenCalled();
  });

  it("routes TikTok jobs to the TikTok service", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue(jobForProvider("TIKTOK"));
    tiktokMock.mockResolvedValue({ state: "PUBLISHED" });

    await processPublishingJob("job-2");

    expect(tiktokMock).toHaveBeenCalledWith("job-2");
    expect(instagramMock).not.toHaveBeenCalled();
  });

  it("rejects providers without a publishing implementation", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue(jobForProvider("LINKEDIN"));
    await expect(processPublishingJob("job-3")).rejects.toThrow(/not implemented for LINKEDIN/);
  });

  it("returns null for an unknown job", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue(null);
    expect(await processPublishingJob("missing")).toBeNull();
  });
});
