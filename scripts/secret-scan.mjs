#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const forbiddenPatterns = [
  /AKIA[0-9A-Z]{16}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?[a-zA-Z0-9._-]{20,}/,
  /OPENAI_API_KEY\s*=\s*["']?sk-/,
];

const scanTargets = ["src", "tests", "scripts", "prisma", ".github"];
const allowedFiles = new Set([".env.example", "docs/ENVIRONMENT.md", "docs/SECURITY_BASELINE.md"]);

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }
      files.push(...walk(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

const violations = [];

for (const target of scanTargets) {
  if (!fs.existsSync(target)) {
    continue;
  }

  for (const filePath of walk(target)) {
    const relativePath = filePath.replace(/\\/g, "/");
    if (allowedFiles.has(relativePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        violations.push({ filePath: relativePath, pattern: pattern.toString() });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Potential secrets detected:");
  for (const violation of violations) {
    console.error(`- ${violation.filePath} matched ${violation.pattern}`);
  }
  process.exit(1);
}

console.log("Secret scan passed.");
