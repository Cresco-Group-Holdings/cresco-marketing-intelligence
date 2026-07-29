#!/usr/bin/env node

/**
 * Invokes the tenant-agnostic publishing scheduler endpoint. Intended for cron (GitHub Actions,
 * Kubernetes CronJob, or any scheduler that can issue an authenticated HTTPS request).
 *
 * Required environment:
 *   APP_URL                  Base URL of the deployed application.
 *   PUBLISHING_WORKER_TOKEN  Shared worker service token.
 * Optional:
 *   PUBLISHING_WORKER_BATCH  Maximum publishing jobs drained per invocation.
 */

const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
const token = process.env.PUBLISHING_WORKER_TOKEN;
const limit = process.env.PUBLISHING_WORKER_BATCH;

if (!appUrl || !token) {
  console.error("APP_URL and PUBLISHING_WORKER_TOKEN are required to run the publishing scheduler.");
  process.exit(1);
}

const url = new URL(`${appUrl}/api/publishing-scheduler/process-due`);
if (limit) url.searchParams.set("limit", limit);

const response = await fetch(url, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
});

const body = await response.text();
if (!response.ok) {
  console.error(`Publishing scheduler failed with status ${response.status}: ${body}`);
  process.exit(1);
}

console.log(body);
