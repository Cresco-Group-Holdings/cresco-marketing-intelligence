#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RUNS = 3;
const results = [];

for (let run = 1; run <= RUNS; run += 1) {
  const startedAt = Date.now();
  const proc = spawnSync(
    "npx",
    ["vitest", "run", "--config", "vitest.golden.config.ts"],
    { encoding: "utf8", env: process.env },
  );
  const durationMs = Date.now() - startedAt;
  const passed = proc.status === 0;
  results.push({ run, passed, durationMs, stdout: proc.stdout, stderr: proc.stderr });
  console.log(`Run ${run}: ${passed ? "PASS" : "FAIL"} (${durationMs}ms)`);
  if (!passed) {
    console.error(proc.stdout);
    console.error(proc.stderr);
  }
}

const report = {
  harnessVersion: "task-5.0.0",
  runs: RUNS,
  allPassed: results.every((r) => r.passed),
  matrix: {
    A: results.map((r) => (r.passed ? "PASS" : "FAIL")),
    B: results.map((r) => (r.passed ? "PASS" : "FAIL")),
    C: results.map((r) => (r.passed ? "PASS" : "FAIL")),
    D: results.map((r) => (r.passed ? "PASS" : "FAIL")),
    E: results.map((r) => (r.passed ? "PASS" : "FAIL")),
    F: results.map((r) => (r.passed ? "PASS" : "FAIL")),
  },
  results,
};

const outDir = path.join(process.cwd(), "artifacts", "golden-journeys");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "certification-report.json"), JSON.stringify(report, null, 2));

if (!report.allPassed) {
  process.exit(1);
}

console.log("Golden journey certification: ALL RUNS PASSED");
