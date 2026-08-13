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

const tsconfigBuildPath = path.join(process.cwd(), "tsconfig.build.json");
if (!fs.existsSync(tsconfigBuildPath)) {
  errors.push("tsconfig.build.json is required for production Next.js type-check scope.");
}

const nextConfigPath = path.join(process.cwd(), "next.config.ts");
if (fs.existsSync(nextConfigPath)) {
  const nextConfig = fs.readFileSync(nextConfigPath, "utf8");
  if (!/tsconfigPath:\s*["']\.?\/tsconfig\.build\.json["']/.test(nextConfig)) {
    errors.push('next.config.ts must set typescript.tsconfigPath to "./tsconfig.build.json".');
  }
  if (!/webpackMemoryOptimizations:\s*true/.test(nextConfig)) {
    errors.push("next.config.ts must enable experimental.webpackMemoryOptimizations.");
  }
}

const heapMatch = /--max-old-space-size=(\d+)/.exec(buildScript);
if (heapMatch) {
  const heapMb = Number(heapMatch[1]);
  if (!Number.isFinite(heapMb) || heapMb > 8192) {
    errors.push(`package.json "build" heap must not exceed 8192 MB. Found: ${heapMb}`);
  }
  if (heapMb < 6144) {
    errors.push(
      `package.json "build" heap must be at least 6144 MB for Prisma-heavy type-checking. Found: ${heapMb}`,
    );
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

console.log("Vercel build script validation passed (lean production build).");
