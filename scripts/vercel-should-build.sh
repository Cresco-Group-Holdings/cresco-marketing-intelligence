#!/usr/bin/env bash
# Vercel Ignored Build Step
# Exit 0 → skip deployment (saves Hobby concurrent build slot)
# Exit 1 → proceed with build
#
# Policy: https://github.com/Cresco-Group-Holdings/cresco-marketing-intelligence/blob/main/docs/deployment/VERCEL_BUILD.md

set -euo pipefail

branch="${VERCEL_GIT_COMMIT_REF:-}"

# Production: always deploy main
if [[ "$branch" == "main" ]]; then
  echo "Building: production branch (main)"
  exit 1
fi

# Explicit opt-in marker committed to the branch
if [[ -f ".vercel/preview-required" ]]; then
  echo "Building: .vercel/preview-required marker present"
  exit 1
fi

# Opt-in via commit message tag
if git log -1 --pretty=%B 2>/dev/null | grep -qE '\[vercel-preview\]'; then
  echo "Building: [vercel-preview] in latest commit message"
  exit 1
fi

# Branch naming convention for preview branches
if [[ "$branch" =~ -preview- ]] || [[ "$branch" =~ -vercel-preview ]]; then
  echo "Building: branch name includes preview opt-in segment"
  exit 1
fi

# Default: skip preview for cursor development branches (GitHub CI validates)
echo "Skipping Vercel build for branch '${branch}' (no preview opt-in). Use .vercel/preview-required, [vercel-preview] commit tag, or vercel-preview label workflow."
exit 0
