#!/usr/bin/env node

/**
 * Safe production/staging smoke probes — HTTP status only, no secrets.
 *
 * Usage:
 *   APP_URL=https://example.com node scripts/run-production-smoke.mjs
 */

const baseUrl = (process.env.APP_URL ?? "https://cresco-marketing-intelligence.vercel.app").replace(
  /\/$/,
  "",
);

const routes = [
  "/",
  "/login",
  "/dashboard",
  "/calendar",
  "/getting-started",
  "/integrations",
  "/content/studio",
  "/analytics",
  "/automation",
  "/operations",
  "/settings",
  "/pricing",
  "/api/health",
  "/api/readiness",
  "/dev/command-centre-preview",
];

const results = [];
let failed = false;

for (const path of routes) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    const pass = response.status < 500;
    results.push({ path, status: response.status, pass });
    if (!pass) failed = true;
    console.log(`${pass ? "PASS" : "FAIL"}  ${response.status} ${path}`);
  } catch (error) {
    failed = true;
    results.push({
      path,
      status: 0,
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`FAIL  ${path} (${error instanceof Error ? error.message : String(error)})`);
  }
}

// Worker/cron fail-closed probes
for (const [path, method] of [
  ["/api/workers/dispatch", "POST"],
  ["/api/cron/daily-dispatch", "GET"],
]) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: "Bearer invalid-token" },
    signal: AbortSignal.timeout(15_000),
  });
  const pass = response.status === 401 || response.status === 403;
  results.push({ path: `${path} (invalid token)`, status: response.status, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${response.status} ${path} invalid token`);
  if (!pass) failed = true;
}

console.log("");
console.log(`Production smoke: ${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
