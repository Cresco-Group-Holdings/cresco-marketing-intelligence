#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const vercelPath = path.join(ROOT, "vercel.json");

if (!fs.existsSync(vercelPath)) {
  console.log("No vercel.json — skipping Vercel cron validation.");
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
const crons = config.crons ?? [];

function isHobbyCompatible(expression) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour] = parts;
  if ([minute, hour, ...parts.slice(2)].some((field) => field.includes("*/"))) return false;
  if (minute === "*" || hour === "*") return false;
  if (!/^\d+(,\d+)*$/.test(minute)) return false;
  if (!/^\d+(,\d+)*$/.test(hour)) return false;
  return true;
}

const errors = [];

for (const cron of crons) {
  if (!cron.path || !cron.schedule) {
    errors.push(`Invalid cron entry: ${JSON.stringify(cron)}`);
    continue;
  }

  if (!isHobbyCompatible(cron.schedule)) {
    errors.push(
      `Cron ${cron.path} uses schedule "${cron.schedule}" which exceeds Vercel Hobby (max once per day).`,
    );
  }
}

if (errors.length > 0) {
  console.error("Vercel cron validation failed:\n");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Vercel cron validation passed (${crons.length} job(s), Hobby-compatible).`);
