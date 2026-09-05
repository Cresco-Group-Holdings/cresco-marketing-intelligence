import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const manifestPath = path.join(process.cwd(), ".e2e", "tenant-manifest.json");

if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  process.env.TEST_AUTH_USER_ID = manifest.defaultAuthUserId;
  process.env.TEST_AUTH_EMAIL = manifest.tenantA?.users?.owner?.email ?? "e2e-owner@example.test";
}

process.env.NODE_ENV = "development";
process.env.CRESCO_E2E_HARNESS = process.env.CRESCO_E2E_HARNESS ?? "true";
process.env.ALLOW_TEST_AUTH = process.env.ALLOW_TEST_AUTH ?? "true";

const child = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

function shutdown(signal) {
  if (!child.killed) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
