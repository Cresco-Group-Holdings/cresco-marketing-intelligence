import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const crawlService = vi.hoisted(() => ({
  process: vi.fn(),
  processDue: vi.fn(),
}));

vi.mock("@/server/services/seo-crawl-service", () => ({
  seoCrawlService: crawlService,
}));

import { POST as processRun } from "@/app/api/seo-crawl/[runId]/process/route";
import { POST as processDue } from "@/app/api/seo-crawl/process-due/route";

const TOKEN = "worker-secret-token";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://app.test${path}`, { method: "POST", headers });
}

const authorised = { authorization: `Bearer ${TOKEN}` };
const params = (runId: string) => ({ params: Promise.resolve({ runId }) });

describe("SEO crawl worker route authorization", () => {
  const originalToken = process.env.PUBLISHING_WORKER_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBLISHING_WORKER_TOKEN = TOKEN;
    crawlService.process.mockResolvedValue({ status: "COMPLETED" });
    crawlService.processDue.mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.PUBLISHING_WORKER_TOKEN;
    else process.env.PUBLISHING_WORKER_TOKEN = originalToken;
  });

  it("accepts process-due with bearer token", async () => {
    const response = await processDue(request("/api/seo-crawl/process-due", authorised));
    expect(response.status).toBe(200);
  });

  it("rejects process-due without token", async () => {
    const response = await processDue(request("/api/seo-crawl/process-due"));
    expect(response.status).toBe(403);
  });

  it("accepts process run with bearer token", async () => {
    const response = await processRun(
      request("/api/seo-crawl/run-1/process", authorised),
      params("run-1"),
    );
    expect(response.status).toBe(200);
  });
});
