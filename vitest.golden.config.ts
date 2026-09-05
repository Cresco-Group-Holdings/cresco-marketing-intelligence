import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Golden Customer Journey certification suite (Tasks 5 A–F).
 * Uses canonical service/integration paths with deterministic provider boundaries.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/golden/integration/**/*.test.ts"],
    globals: true,
    setupFiles: ["./tests/setup-env.ts"],
    testTimeout: 120_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
