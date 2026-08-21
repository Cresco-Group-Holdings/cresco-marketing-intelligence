#!/usr/bin/env node

/**
 * CI guard: Vercel `npm run build` must stay lean (next build only).
 * Quality gates belong in GitHub Actions, not the Vercel build step.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const loadConfig = require("next/dist/server/config").default;

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

  const buildCommand = vercelJson.buildCommand ?? "";
  if (!/\bnext\s+build\b/.test(buildCommand) && !/\bnpm\s+run\s+build\b/.test(buildCommand)) {
    errors.push(
      'vercel.json must set "buildCommand" to "npm run build" (compile-only; no validators or heap overrides).',
    );
  }
  for (const { pattern, label } of forbiddenPatterns) {
    if (pattern.test(buildCommand)) {
      errors.push(`vercel.json buildCommand must not run ${label}. Found: ${buildCommand}`);
    }
  }
  if (/--max-old-space-size=8192/.test(buildCommand)) {
    errors.push(
      'vercel.json buildCommand must not set NODE_OPTIONS=--max-old-space-size=8192 (causes Hobby OOM / 45m timeout).',
    );
  }
}

const nextConfigCandidates = ["next.config.mjs", "next.config.js", "next.config.ts"];
const nextConfigPath = nextConfigCandidates
  .map((name) => path.join(process.cwd(), name))
  .find((candidate) => fs.existsSync(candidate));

if (!nextConfigPath) {
  errors.push("Missing Next.js config (next.config.mjs, next.config.js, or next.config.ts).");
} else {
  const nextConfigSource = fs.readFileSync(nextConfigPath, "utf8");
  const nextConfigLabel = path.basename(nextConfigPath);

  if (!/ignoreDuringBuilds:\s*true/.test(nextConfigSource)) {
    errors.push(`${nextConfigLabel} must set eslint.ignoreDuringBuilds: true (lint runs in CI).`);
  }
  if (!/ignoreBuildErrors:\s*true/.test(nextConfigSource)) {
    errors.push(
      `${nextConfigLabel} must set typescript.ignoreBuildErrors: true (typecheck runs in CI; avoids Vercel OOM).`,
    );
  }
  if (/ignoreBuildErrors:\s*false/.test(nextConfigSource)) {
    errors.push(`${nextConfigLabel} must not set typescript.ignoreBuildErrors: false.`);
  }
  if (!/webpackMemoryOptimizations:\s*true/.test(nextConfigSource)) {
    errors.push(`${nextConfigLabel} must enable experimental.webpackMemoryOptimizations.`);
  }
  if (!/parallelServerCompiles:\s*false/.test(nextConfigSource)) {
    errors.push(`${nextConfigLabel} must set experimental.parallelServerCompiles: false (Hobby memory).`);
  }
  if (!/parallelServerBuildTraces:\s*false/.test(nextConfigSource)) {
    errors.push(
      `${nextConfigLabel} must set experimental.parallelServerBuildTraces: false (Hobby memory).`,
    );
  }
  if (/--max-old-space-size=8192/.test(nextConfigSource)) {
    errors.push(`${nextConfigLabel} must not set NODE_OPTIONS=--max-old-space-size=8192.`);
  }

  if (fs.existsSync(path.join(process.cwd(), "next.config.ts")) && fs.existsSync(path.join(process.cwd(), "next.config.mjs"))) {
    errors.push("Only one Next.js config file is allowed — remove next.config.ts when next.config.mjs is present.");
  }
}

if (/--max-old-space-size=8192/.test(buildScript)) {
  errors.push(
    'package.json "build" must not set NODE_OPTIONS=--max-old-space-size=8192 (causes Vercel Hobby OOM during type validation).',
  );
}

const heapMatch = /--max-old-space-size=(\d+)/.exec(buildScript);
if (heapMatch) {
  const heapMb = Number(heapMatch[1]);
  if (!Number.isFinite(heapMb) || heapMb > 8192) {
    errors.push(`package.json "build" heap must not exceed 8192 MB. Found: ${heapMb}`);
  }
  if (heapMb > 7680) {
    errors.push(
      `package.json "build" heap should be <= 7680 MB on Vercel Hobby (8192 MB container). Found: ${heapMb}`,
    );
  }
}

if (errors.length > 0) {
  console.error("Vercel build script validation failed:\n");
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

try {
  const effectiveConfig = await loadConfig("phase-production-build", process.cwd(), {
    silent: true,
  });

  if (effectiveConfig.typescript?.ignoreBuildErrors !== true) {
    console.error("Vercel build script validation failed:\n");
    console.error(
      `- Effective Next.js config must set typescript.ignoreBuildErrors: true (got ${JSON.stringify(effectiveConfig.typescript?.ignoreBuildErrors)}).`,
    );
    console.error(
      "  Vercel would run full build-time TypeScript validation and OOM on Hobby builders.",
    );
    process.exit(1);
  }

  if (effectiveConfig.eslint?.ignoreDuringBuilds !== true) {
    console.error("Vercel build script validation failed:\n");
    console.error(
      `- Effective Next.js config must set eslint.ignoreDuringBuilds: true (got ${JSON.stringify(effectiveConfig.eslint?.ignoreDuringBuilds)}).`,
    );
    process.exit(1);
  }
} catch (error) {
  console.error("Vercel build script validation failed:\n");
  console.error(`- Failed to load effective Next.js config: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

console.log("Vercel build script validation passed (lean production build).");
