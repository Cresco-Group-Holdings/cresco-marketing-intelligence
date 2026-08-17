#!/usr/bin/env node
/**
 * Migrates legacy Tailwind color classes to Cresco semantic tokens.
 * Run: node scripts/migrate-visual-tokens.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src");

const REPLACEMENTS = [
  // Text
  ["text-slate-900", "text-foreground"],
  ["text-slate-800", "text-foreground"],
  ["text-gray-900", "text-foreground"],
  ["text-zinc-900", "text-foreground"],
  ["text-stone-900", "text-foreground"],
  ["text-slate-700", "text-foreground-muted"],
  ["text-slate-600", "text-foreground-muted"],
  ["text-gray-700", "text-foreground-muted"],
  ["text-gray-600", "text-foreground-muted"],
  ["text-zinc-700", "text-foreground-muted"],
  ["text-zinc-600", "text-foreground-muted"],
  ["text-stone-700", "text-foreground-muted"],
  ["text-stone-600", "text-foreground-muted"],
  ["text-slate-500", "text-foreground-subtle"],
  ["text-slate-400", "text-foreground-subtle"],
  ["text-gray-500", "text-foreground-subtle"],
  ["text-gray-400", "text-foreground-subtle"],
  ["text-zinc-500", "text-foreground-subtle"],
  ["text-zinc-400", "text-foreground-subtle"],
  ["text-stone-500", "text-foreground-subtle"],
  ["text-stone-400", "text-foreground-subtle"],
  // Backgrounds
  ["bg-white", "bg-surface-elevated"],
  ["bg-slate-50", "bg-surface-subtle"],
  ["bg-gray-50", "bg-surface-subtle"],
  ["bg-zinc-50", "bg-surface-subtle"],
  ["bg-stone-50", "bg-surface-subtle"],
  ["bg-slate-100", "bg-surface-hover"],
  ["bg-gray-100", "bg-surface-hover"],
  ["bg-zinc-100", "bg-surface-hover"],
  ["bg-stone-100", "bg-surface-hover"],
  ["bg-slate-200", "bg-surface-hover"],
  // Borders
  ["border-slate-200", "border-border"],
  ["border-gray-200", "border-border"],
  ["border-zinc-200", "border-border"],
  ["border-stone-200", "border-border"],
  ["border-slate-100", "border-border-subtle"],
  ["border-gray-100", "border-border-subtle"],
  ["border-slate-300", "border-border-strong"],
  ["border-gray-300", "border-border-strong"],
  ["border-zinc-300", "border-border-strong"],
  // Hover
  ["hover:bg-slate-100", "hover:bg-surface-hover"],
  ["hover:bg-slate-50", "hover:bg-surface-hover"],
  ["hover:bg-gray-100", "hover:bg-surface-hover"],
  ["hover:text-slate-900", "hover:text-foreground"],
  ["hover:text-slate-700", "hover:text-foreground"],
  ["hover:text-gray-900", "hover:text-foreground"],
  // Focus rings
  ["focus-visible:ring-slate-400", "focus-visible:ring-ring"],
  ["focus-visible:ring-slate-500", "focus-visible:ring-ring"],
  ["focus-visible:ring-slate-200", "focus-visible:ring-ring"],
  ["focus-visible:ring-slate-900", "focus-visible:ring-ring"],
  // Placeholder
  ["placeholder:text-slate-400", "placeholder:text-foreground-subtle"],
  ["placeholder:text-gray-400", "placeholder:text-foreground-subtle"],
  // Error colors (semantic)
  ["text-red-600", "text-danger"],
  ["text-red-500", "text-danger"],
  ["border-red-500", "border-danger"],
  ["focus-visible:ring-red-100", "focus-visible:ring-danger-muted"],
  // Overlays
  ["bg-slate-900/40", "bg-foreground/40"],
  ["bg-slate-900/50", "bg-foreground/50"],
  ["bg-black/40", "bg-foreground/40"],
  ["bg-black/50", "bg-foreground/50"],
];

const SKIP_DIRS = new Set(["node_modules", ".next", "generated"]);
const EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

let totalReplacements = 0;
let filesChanged = 0;

for (const file of walk(ROOT)) {
  let content = readFileSync(file, "utf8");
  const original = content;
  let fileCount = 0;

  for (const [from, to] of REPLACEMENTS) {
    const parts = content.split(from);
    if (parts.length > 1) {
      const count = parts.length - 1;
      content = parts.join(to);
      fileCount += count;
    }
  }

  if (content !== original) {
    writeFileSync(file, content);
    filesChanged += 1;
    totalReplacements += fileCount;
    console.log(`Updated ${file.replace(ROOT + "/", "")} (${fileCount} replacements)`);
  }
}

console.log(`\nDone: ${totalReplacements} replacements across ${filesChanged} files.`);
