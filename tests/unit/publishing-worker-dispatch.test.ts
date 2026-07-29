import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ publishingJob: { findUnique: vi.fn() } }));
const instagramMock = vi.hoisted(() => vi.fn());
const tiktokMock = vi.hoisted(() => vi.fn());
const linkedInFacebookMock = vi.hoisted(() => vi.fn());
const youtubeXMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/instagram-publishing-service", () => ({
  instagramPublishingService: { process: instagramMock },
}));
vi.mock("@/server/services/tiktok-publishing-service", () => ({
  tikTokPublishingService: { process: tiktokMock },
}));
vi.mock("@/server/services/linkedin-facebook-publishing-service", () => ({
  linkedInFacebookPublishingService: { process: linkedInFacebookMock },
}));
vi.mock("@/server/services/youtube-x-publishing-service", () => ({
  youtubeXPublishingService: { process: youtubeXMock },
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

  it("routes LinkedIn and Facebook jobs to their shared service", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue(jobForProvider("LINKEDIN"));
    await processPublishingJob("job-3");
    expect(linkedInFacebookMock).toHaveBeenCalledWith("job-3");

    prismaMock.publishingJob.findUnique.mockResolvedValue(jobForProvider("FACEBOOK"));
    await processPublishingJob("job-4");
    expect(linkedInFacebookMock).toHaveBeenCalledWith("job-4");
  });

  it("routes YouTube and X jobs to their shared service", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue(jobForProvider("YOUTUBE"));
    await processPublishingJob("job-5");
    expect(youtubeXMock).toHaveBeenCalledWith("job-5");

    prismaMock.publishingJob.findUnique.mockResolvedValue(jobForProvider("X"));
    await processPublishingJob("job-6");
    expect(youtubeXMock).toHaveBeenCalledWith("job-6");
  });

  it("returns null for an unknown job", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue(null);
    expect(await processPublishingJob("missing")).toBeNull();
  });
});
