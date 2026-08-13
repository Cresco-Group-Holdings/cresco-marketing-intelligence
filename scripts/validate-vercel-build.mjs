#!/usr/bin/env node

/**
 * CI guard: Vercel `npm run build` must stay lean (next build only).
 * Quality gates belong in GitHub Actions, not the Vercel build step.
 */

import fs from "node:fs";
import path from "node:path";

const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const buildScript = packageJson.scripts?.build ?? "";

const errors = [];

const forbiddenPatterns = [
  { pattern: /\bvitest\b/i, label: "tests (vitest)" },
  { pattern: /\bplaywright\b/i, label: "E2E (playwright)" },
  { pattern: /\beslint\b/i, label: "lint" },
  { pattern: /\btsc\b/i, label: "typecheck (tsc)" },
  { pattern: /\bvalidate:migrations\b/, label: "migration validation" },
  { pattern: /\bvalidate:routes\b/, label: "route validation" },
  { pattern: /\bvalidate:vercel-cron\b/, label: "cron validation" },
  { pattern: /\bvalidate:rls-security\b/, label: "RLS validation" },
  { pattern: /\baudit:secrets\b/, label: "secret scan" },
  { pattern: /\bprisma\s+generate\b/, label: "prisma generate (use postinstall)" },
  { pattern: /\bprisma\s+migrate\b/, label: "prisma migrate" },
  { pattern: /--turbopack\b/, label: "turbopack production flag" },
];

for (const { pattern, label } of forbiddenPatterns) {
  if (pattern.test(buildScript)) {
    errors.push(`package.json "build" must not run ${label}. Found in: ${buildScript}`);
  }
}

if (!/\bnext\s+build\b/.test(buildScript)) {
  errors.push(`package.json "build" must invoke "next build". Found: ${buildScript}`);
}

if (!packageJson.scripts?.["build:ci"]) {
  errors.push('package.json must define "build:ci" for GitHub Actions production build checks.');
}

const vercelJsonPath = path.join(process.cwd(), "vercel.json");
if (fs.existsSync(vercelJsonPath)) {
  const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
  if (!vercelJson.ignoreCommand) {
    errors.push('vercel.json must set "ignoreCommand" to enforce preview deployment policy.');
  }
}

if (errors.length > 0) {
  console.error("Vercel build script validation failed:\n");
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("Vercel build script validation passed (lean production build).");
