# Vercel Build & Preview Deployment Policy

This document defines how Cresco Marketing Intelligence uses Vercel on the **Hobby** plan (one concurrent build, 45-minute build step limit).

## Division of responsibility

| Concern | GitHub Actions | Vercel |
|---------|----------------|--------|
| Lint | ✅ `npm run lint` | ❌ |
| Typecheck | ✅ `npm run typecheck` | ❌ |
| Unit tests | ✅ `npm run test:unit` | ❌ |
| Integration tests | ✅ `npm run test:integration` | ❌ |
| Database tests | ✅ `npm run test:database` (when Prisma changes) | ❌ |
| Migration validation | ✅ `npm run validate:migrations` | ❌ |
| Route / cron / RLS validators | ✅ quality job | ❌ |
| Secret scan | ✅ `npm run audit:secrets` | ❌ |
| Lean build script guard | ✅ `npm run validate:vercel-build` | ❌ |
| Prisma Client generation | ✅ `postinstall` during `npm ci` | ✅ `postinstall` during Install |
| Production Next.js compile | ✅ `npm run build:ci` (optional build job) | ✅ `npm run build` |
| Browser preview hosting | ❌ | ✅ (opt-in only) |
| Production (`main`) | ❌ | ✅ always |

## Vercel Install step

```
npm ci
  └─ postinstall → prisma generate   (single generation point)
```

## Vercel Build step

```
npm run build
  └─ next build                    (no lint, tests, validators, or duplicate prisma generate)
```

`next.config.ts` sets `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` because ESLint and TypeScript run in GitHub CI. Vercel performs an optimized compile-only build to stay within Hobby memory limits.

## Type safety model

| Layer | Responsibility |
|-------|----------------|
| **GitHub CI** | Authoritative `npm run typecheck` (`tsconfig.typecheck.json`, includes app + tests) |
| **Vercel** | Compile-only `next build` — skips redundant in-build type validation |

This avoids running two full TypeScript programs on memory-constrained Vercel builders (~8 GB), which previously caused SIGKILL during "Checking validity of types".

`experimental.webpackMemoryOptimizations`, `parallelServerCompiles: false`, `parallelServerBuildTraces: false`, and `cpus: 1` reduce peak RSS during `next build` on Hobby.

**Do not** set `NODE_OPTIONS=--max-old-space-size=8192` on `npm run build` — that leaves no headroom for native allocations on Hobby and can trigger SIGKILL. The production build script is plain `next build` with no heap override; memory is controlled by skipping in-build type validation and the experimental webpack settings above.

## Prisma policy

- **Generate once** per install via `postinstall`.
- **Never** run `prisma migrate` during Vercel build.
- **Never** duplicate `prisma generate` inside `npm run build`.
- CI runs an explicit `npx prisma generate` after `npm ci` before typecheck for deterministic typing (postinstall already generated; explicit step is idempotent).

## Preview deployment policy (Hobby queue protection)

By default, **cursor development branches do not deploy to Vercel**. GitHub Actions validates them.

Vercel builds proceed only when one of:

1. Branch is **`main`** (customer production project)
2. Branch is **`staging`** on Vercel project **`cresco-marketing-intelligence-staging`** only (dedicated staging production)
3. File **`.vercel/preview-required`** exists on the branch
4. Latest commit message contains **`[vercel-preview]`**
5. Branch name contains **`-preview-`** or **`-vercel-preview`**
6. GitHub label **`vercel-preview`** on the PR (workflow commits the marker file)

### Requesting a preview

**Recommended:** Add the `vercel-preview` label to the PR. The workflow writes `.vercel/preview-required` and pushes to the branch.

**Manual:** Create `.vercel/preview-required` on the branch and push.

**One-off:** Include `[vercel-preview]` in a commit message.

## Performance targets

| Scenario | Target |
|----------|--------|
| Vercel Build step (`npm run build`) | **< 15 minutes** |
| Cached Vercel Build | **< 8 minutes** (ideal) |
| Full CI pipeline | Separate from Vercel; may be longer |

Run local profiling:

```bash
npm ci
node scripts/measure-build-stages.mjs
node scripts/measure-build-memory.mjs
```

## Guardrails

`npm run validate:vercel-build` fails if:

- `package.json` `build` script includes tests, lint, typecheck, validators, migrations, or duplicate `prisma generate`
- `package.json` `build` sets `NODE_OPTIONS=--max-old-space-size=8192` or heap above 7680 MB
- `next.config.ts` is missing `ignoreBuildErrors`, `webpackMemoryOptimizations`, or Hobby memory limits (`parallelServerCompiles: false`, `parallelServerBuildTraces: false`)
- `vercel.json` is missing `ignoreCommand`

This runs in GitHub Actions quality jobs.

## Sharp

Image processing uses `@/lib/images/sharp-loader` (dynamic `import("sharp")`). `serverExternalPackages: ["sharp"]` keeps native binaries external to route bundles.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Build fails at ~46 min | Build step exceeded 45 min — ensure lean `build` script |
| Build SIGKILL / OOM during type check | Ensure `typescript.ignoreBuildErrors: true`, no `max-old-space-size=8192` on `build`, and webpack memory optimizations enabled |
| Preview never appears | Branch skipped by `ignoreCommand` — add opt-in marker |
| Typecheck errors in CI | Stale Prisma client — CI runs `prisma generate` after `npm ci` |
| Hobby queue blocked | Too many concurrent previews — use opt-in policy |
