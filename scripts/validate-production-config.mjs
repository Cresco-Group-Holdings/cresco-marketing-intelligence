#!/usr/bin/env node

/**
 * Validates production configuration shape and cross-consistency without printing secrets.
 *
 * Usage:
 *   node scripts/validate-production-config.mjs
 *   NODE_ENV=production node scripts/validate-production-config.mjs
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const result = spawnSync("npx", ["tsx", "scripts/run-production-config-validation.ts"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env,
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exit(result.status ?? 1);
