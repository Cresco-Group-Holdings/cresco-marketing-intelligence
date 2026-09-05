#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");

const WEBHOOK_PREFIX = "/api/webhooks/";
const OAUTH_CALLBACK_PATHS = new Set([
  "/api/connectors/oauth/callback",
  "/api/social/oauth/callback",
]);
const OAUTH_CALLBACK_PREFIXES = [
  "/api/connectors/oauth/",
  "/api/integrations/oauth/",
  "/api/social/oauth/",
];
const WORKER_PREFIXES = [
  "/api/publishing-scheduler/",
  "/api/publishing-jobs/",
  "/api/social-analytics-sync/",
  "/api/seo-crawl/",
  "/api/notifications/digest/",
];
const WORKER_EXACT = new Set([
  "/api/social-reports/process-due",
  "/api/digital-assets/process-due",
]);
const CRON_PREFIXES = ["/api/cron/", "/api/workers/"];
const CRON_EXACT = new Set(["/api/publishing-scheduler/process-due"]);
const TOKEN_PUBLIC_PREFIXES = ["/api/reports/shared/"];
const TOKEN_PUBLIC_EXACT = new Set(["/api/tracking/v1/server-events"]);
const TRACKING_EXACT = new Set(["/api/tracking/v1/events"]);
const PUBLIC_PREFIXES = ["/api/health", "/api/readiness", "/api/auth/"];
const PUBLIC_FORM_PATTERN = /^\/api\/forms\/v1\/[^/]+\/submit$/;

function classify(pathname) {
  if (!pathname.startsWith("/api/")) return null;
  if (pathname.startsWith(WEBHOOK_PREFIX)) return "WEBHOOK";
  if (
    OAUTH_CALLBACK_PATHS.has(pathname) ||
    OAUTH_CALLBACK_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return "OAUTH_CALLBACK";
  }
  if (CRON_EXACT.has(pathname) || CRON_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "CRON_INTERNAL";
  }
  if (WORKER_EXACT.has(pathname) || WORKER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "WORKER_INTERNAL";
  }
  if (TOKEN_PUBLIC_EXACT.has(pathname) || TOKEN_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "TOKEN_PUBLIC";
  }
  if (TRACKING_EXACT.has(pathname) || PUBLIC_FORM_PATTERN.test(pathname)) {
    return "TRACKING_PUBLIC";
  }
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return "PUBLIC_WEB";
  }
  return "AUTHENTICATED";
}

function walk(dir, segments = []) {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const full = path.join(dir, name);
    if (name.startsWith("(") && name.endsWith(")")) {
      routes.push(...walk(full, segments));
      continue;
    }
    const isDynamic = name.startsWith("[") && name.endsWith("]");
    const segment = isDynamic ? `[${name.slice(1, -1)}]` : name;
    const routeFile = path.join(full, "route.ts");
    if (fs.existsSync(routeFile)) {
      routes.push(`/api/${[...segments, segment].join("/")}`);
    }
    routes.push(...walk(full, [...segments, segment]));
  }
  return routes;
}

if (!fs.existsSync(API_ROOT)) {
  console.error("Missing src/app/api directory.");
  process.exit(1);
}

const routes = walk(API_ROOT).sort();
const unclassified = routes.filter((route) => classify(route) === null);
const counts = {};

for (const route of routes) {
  const klass = classify(route);
  counts[klass] = (counts[klass] ?? 0) + 1;
}

if (unclassified.length > 0) {
  console.error("Unclassified API routes detected:\n");
  for (const route of unclassified) {
    console.error(`  - ${route}`);
  }
  process.exit(1);
}

console.log(`Validated ${routes.length} API routes.`);
for (const [klass, count] of Object.entries(counts).sort()) {
  console.log(`  ${klass}: ${count}`);
}
