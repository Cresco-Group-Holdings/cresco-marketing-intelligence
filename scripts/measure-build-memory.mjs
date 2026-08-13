#!/usr/bin/env node

/**
 * Runs `npm run build` and samples peak RSS of the build process tree.
 * Usage: node scripts/measure-build-memory.mjs
 */

import { spawn } from "node:child_process";
import { execSync } from "node:child_process";

function sampleRssKb(rootPid) {
  try {
    const output = execSync(`ps -o rss= --ppid ${rootPid} 2>/dev/null; ps -o rss= -p ${rootPid} 2>/dev/null`, {
      encoding: "utf8",
    });
    const values = output
      .split(/\s+/)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return values.length ? Math.max(...values) : 0;
  } catch {
    return 0;
  }
}

const started = Date.now();
let peakRssKb = 0;

const child = spawn("npm", ["run", "build"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

const interval = setInterval(() => {
  const rss = sampleRssKb(child.pid);
  if (rss > peakRssKb) peakRssKb = rss;
}, 500);

child.on("close", (code) => {
  clearInterval(interval);
  const durationSec = ((Date.now() - started) / 1000).toFixed(1);
  const peakMb = (peakRssKb / 1024).toFixed(1);
  console.log("\n=== Build memory summary ===");
  console.log(`Exit code: ${code}`);
  console.log(`Duration: ${durationSec}s`);
  console.log(`Peak RSS (sampled): ${peakMb} MB`);
  process.exit(code ?? 1);
});
