import { test, expect } from "@playwright/test";

test.describe("@launch-critical scheduled publishing infrastructure", () => {
  test("worker-cycle cron endpoint rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/cron/worker-cycle");
    expect(response.status()).toBe(403);
  });

  test("fallback-cycle endpoint rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/workers/fallback-cycle");
    expect(response.status()).toBe(403);
  });

  test("legacy recover endpoint rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/workers/recover");
    expect(response.status()).toBe(403);
  });
});
