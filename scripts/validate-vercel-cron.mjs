#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const vercelJsonPath = path.join(process.cwd(), "vercel.json");

function fieldHasWildcardOrStep(field) {
  return /[*\/,]/.test(field);
}

function isHobbyCompatibleCronSchedule(schedule) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour] = parts;
  if (fieldHasWildcardOrStep(minute) || fieldHasWildcardOrStep(hour)) {
    return false;
  }

  const minuteValue = Number(minute);
  const hourValue = Number(hour);
  if (!Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 59) {
    return false;
  }
  if (!Number.isInteger(hourValue) || hourValue < 0 || hourValue > 23) {
    return false;
  }

  return true;
}

if (!fs.existsSync(vercelJsonPath)) {
  console.error("Missing vercel.json.");
  process.exit(1);
}

const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));

if (!vercelJson.$schema) {
  console.warn("vercel.json is missing $schema — consider adding https://openapi.vercel.sh/vercel.json");
}

const crons = Array.isArray(vercelJson.crons) ? vercelJson.crons : [];
const incompatible = [];

for (const cron of crons) {
  if (!cron?.path || !cron?.schedule) {
    incompatible.push({ cron, reason: "missing path or schedule" });
    continue;
  }

  if (!isHobbyCompatibleCronSchedule(cron.schedule)) {
    incompatible.push({
      cron,
      reason: "schedule runs more than once per day (Vercel Hobby incompatible)",
    });
  }
}

if (incompatible.length > 0) {
  console.error("Vercel cron validation failed. Hobby plan allows at most one run per cron per day.\n");
  for (const entry of incompatible) {
    console.error(`  path: ${entry.cron.path ?? "(missing)"}`);
    console.error(`  schedule: ${entry.cron.schedule ?? "(missing)"}`);
    console.error(`  reason: ${entry.reason}\n`);
  }
  process.exit(1);
}

console.log(
  `Vercel cron validation passed (${crons.length} cron${crons.length === 1 ? "" : "s"}, Hobby-compatible).`,
);
