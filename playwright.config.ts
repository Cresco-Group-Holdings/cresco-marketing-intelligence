import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.APP_URL ?? "http://localhost:3000";
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 1 : undefined,
  timeout: 90_000,
  globalSetup: "./tests/e2e/support/global-setup.ts",
  reporter: isCi
    ? [["list"], ["html", { open: "never", outputFolder: "artifacts/playwright-report" }]]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
  },
  expect: {
    timeout: 15_000,
  },
  projects: [
    {
      name: "launch-critical",
      grep: /@launch-critical/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      grepInvert: /@external-live/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: "node scripts/start-e2e-web-server.mjs",
          url: `${baseURL}/api/readiness`,
          reuseExistingServer: !isCi,
          timeout: 180_000,
          env: {
            ...process.env,
            NODE_ENV: "development",
            CRESCO_E2E_HARNESS: process.env.CRESCO_E2E_HARNESS ?? "true",
            ALLOW_TEST_AUTH: process.env.ALLOW_TEST_AUTH ?? "true",
            AI_ALLOW_MOCK: process.env.AI_ALLOW_MOCK ?? "true",
            ALLOW_OAUTH_MOCK: process.env.ALLOW_OAUTH_MOCK ?? "true",
            ALLOW_MOCK_SOCIAL_ADAPTERS: process.env.ALLOW_MOCK_SOCIAL_ADAPTERS ?? "true",
          },
        },
      }),
});
