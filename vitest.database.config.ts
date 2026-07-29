import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Real-database suite. It runs against an isolated PostgreSQL instance pointed at by
 * ANALYTICS_TEST_DATABASE_URL and is skipped entirely when that variable is unset, so the standard
 * unit and integration suites stay hermetic.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/database/**/*.test.ts"],
    globals: true,
    setupFiles: ["./tests/setup-database-env.ts"],
    // Shared tables mean the suite must not interleave.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
