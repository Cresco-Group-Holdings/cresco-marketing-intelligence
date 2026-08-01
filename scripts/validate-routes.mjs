#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const appDir = path.join(process.cwd(), "src", "app");
const conflicts = new Map();

function walk(dir, segments = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const name = entry.name;
    const full = path.join(dir, name);

    if (name.startsWith("(") && name.endsWith(")")) {
      walk(full, segments);
      continue;
    }

    const isDynamic = name.startsWith("[") && name.endsWith("]");
    const normalized = isDynamic ? "[]" : name;
    const slug = isDynamic ? name.slice(1, -1) : null;
    const key = [...segments, normalized].join("/");

    if (!conflicts.has(key)) {
      conflicts.set(key, { slugs: new Set(), paths: [] });
    }

    const conflict = conflicts.get(key);
    if (slug) {
      conflict.slugs.add(slug);
    }
    conflict.paths.push(full);
    walk(full, [...segments, normalized]);
  }
}

if (!fs.existsSync(appDir)) {
  console.error("Missing src/app directory.");
  process.exit(1);
}

walk(appDir);

const found = [];
for (const [normalized, { slugs, paths }] of conflicts) {
  if (slugs.size > 1) {
    found.push({
      normalized,
      slugs: [...slugs].sort(),
      paths,
    });
  }
}

if (found.length > 0) {
  console.error("Dynamic route slug conflicts detected:\n");
  for (const conflict of found) {
    console.error(`  Pattern: ${conflict.normalized}`);
    console.error(`  Slugs: ${conflict.slugs.join(", ")}`);
    for (const routePath of conflict.paths) {
      console.error(`    - ${routePath}`);
    }
    console.error("");
  }
  process.exit(1);
}

console.log("Route tree validated: no dynamic slug conflicts found.");
