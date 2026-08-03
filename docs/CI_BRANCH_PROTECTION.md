# CI branch protection

Update GitHub **Settings → Branches → Branch protection rules → `main`** after merging the CI optimisation.

## Required status checks (recommended)

| Check name | Workflow | When it runs |
|------------|----------|--------------|
| `Lint, typecheck, and validation` | Pull Request CI | PR code changes |
| `Unit and integration tests` | Pull Request CI | After quality passes |
| `Production build` | Pull Request CI | PR marked ready for review, or label `ci/build` / `ready-to-merge` |
| `Production build` | Main Branch CI | Every merge to `main` |

## Optional / conditional checks

| Check name | Trigger |
|------------|---------|
| `Database tests` | `prisma/**` changes, label `run-database-tests`, or manual workflow dispatch |
| `Playwright smoke tests` | Label `run-e2e` or manual workflow dispatch |

## Labels

| Label | Effect |
|-------|--------|
| `ci/build` | Run production build on a draft-ready PR without waiting for ready-for-review |
| `ready-to-merge` | Run production build before merge |
| `run-database-tests` | Force database test job on any PR |
| `run-e2e` | Run Playwright E2E workflow |

## Removed from every PR push

The following former required jobs no longer exist as separate checks:

- `lint`, `typecheck`, `prisma-validate`, `migration-validate`, `route-validate` → merged into **Lint, typecheck, and validation**
- `unit-tests`, `integration-tests` → merged into **Unit and integration tests**
- `dependency-audit` → covered by weekly **Scheduled Security Audit** and **Scheduled Dependency Review**

Remove any stale required checks from branch protection after the first green run on the new workflows.

## Merge policy

- Draft PRs: quality + unit/integration only (no build until marked ready for review).
- Docs-only PRs: skipped entirely via `paths-ignore`.
- Merges to `main`: **Main Branch CI** runs build and tests post-merge.
