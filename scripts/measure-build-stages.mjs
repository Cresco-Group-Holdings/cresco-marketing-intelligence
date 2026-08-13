#!/usr/bin/env node

/**
 * Prints a timing table for local build pipeline profiling.
 * Usage: node scripts/measure-build-stages.mjs
 */

import { execSync } from "node:child_process";

function run(label, command) {
  const started = Date.now();
  execSync(command, { stdio: "inherit" });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  return { label, command, seconds };
}

const rows = [];

console.log("\n=== Cresco build stage measurement ===\n");

rows.push(run("validate:routes", "npm run validate:routes"));
rows.push(run("validate:vercel-cron", "npm run validate:vercel-cron"));
rows.push(run("prisma generate", "npx prisma generate"));
rows.push(run("next build (Vercel path)", "npm run build"));

console.log("\n| Step | Command | Duration (s) |");
console.log("|------|---------|--------------|");
for (const row of rows) {
  console.log(`| ${row.label} | \`${row.command}\` | ${row.seconds} |`);
}

console.log("\nNote: Vercel Install runs postinstall (prisma generate) separately from Build (npm run build).\n");
