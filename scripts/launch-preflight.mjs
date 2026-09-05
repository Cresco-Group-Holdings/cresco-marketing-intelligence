#!/usr/bin/env node

/**
 * Aggregated launch pre-flight checks (read-only, no secrets printed).
 *
 * Usage:
 *   node scripts/launch-preflight.mjs
 *   APP_URL=https://staging.example.com node scripts/launch-preflight.mjs
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const categories = [
  { name: "production-config", command: "node scripts/validate-production-config.mjs" },
  { name: "prisma", command: "npm run validate:prisma" },
  { name: "migrations", command: "npm run validate:migrations" },
  { name: "routes", command: "npm run validate:routes" },
  { name: "vercel-cron", command: "npm run validate:vercel-cron" },
  { name: "rls-security", command: "npm run validate:rls-security" },
  { name: "secret-scan", command: "npm run audit:secrets" },
];

function runCommand(command) {
  const result = spawnSync(command, {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  return {
    pass: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function checkDeploymentEndpoint(label, url) {
  if (!url) {
    return { pass: true, message: `${label}: skipped (no URL configured)` };
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const pass = response.ok;
    return {
      pass,
      message: `${label}: ${response.status} ${response.statusText} (${url})`,
    };
  } catch (error) {
    return {
      pass: false,
      message: `${label}: request failed (${url}) — ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

const results = [];

for (const category of categories) {
  const result = runCommand(category.command);
  results.push({ category: category.name, pass: result.pass });
  const status = result.pass ? "PASS" : "FAIL";
  console.log(`${status}  ${category.name}`);
  if (!result.pass) {
    const output = (result.stdout + result.stderr).trim();
    if (output) {
      console.log(output.split("\n").slice(-8).join("\n"));
    }
  }
}

const appUrl = process.env.APP_URL?.replace(/\/$/, "");
const deploymentChecks = [];

if (appUrl) {
  deploymentChecks.push(await checkDeploymentEndpoint("health", `${appUrl}/api/health`));
  deploymentChecks.push(await checkDeploymentEndpoint("readiness", `${appUrl}/api/readiness`));
  deploymentChecks.push(await checkDeploymentEndpoint("homepage", appUrl));
}

for (const check of deploymentChecks) {
  results.push({ category: check.message.split(":")[0], pass: check.pass });
  console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.message}`);
}

const vercelJsonPath = path.join(ROOT, "vercel.json");
if (fs.existsSync(vercelJsonPath)) {
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
  const cronCount = vercelConfig.crons?.length ?? 0;
  console.log(`INFO  vercel-cron-deployed: ${cronCount} job(s) in vercel.json`);
}

const allPass = results.every((result) => result.pass);
console.log("");
console.log(`Launch preflight: ${allPass ? "PASS" : "FAIL"}`);
process.exit(allPass ? 0 : 1);
