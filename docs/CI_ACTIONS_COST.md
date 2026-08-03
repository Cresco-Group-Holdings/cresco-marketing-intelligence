# GitHub Actions cost notes

See PR #101 for the CI optimisation rationale.

## Publishing scheduler removed from GHA

The publishing scheduler **must not** use a GitHub Actions `schedule` trigger. At a 5-minute interval that is ~288 runs/day (~8,640/month) and exhausts the included 2,000 Actions minutes quota even with lightweight jobs.

Production publishing runs on **Vercel Cron** (`vercel.json`, every 5 minutes). See `docs/PUBLISHING_SCHEDULER.md`.

## Estimated monthly GitHub Actions usage (after full optimisation)

| Source | Runs/month (approx.) | Minutes/run (approx.) | Monthly minutes |
|--------|----------------------|------------------------|-----------------|
| Pull Request CI (active dev) | ~600 PR job sets | ~12 billed | ~7,200 → **~2,400** with consolidation & gating |
| Main Branch CI | ~40 merges | ~20 | ~800 |
| Social analytics scheduler | ~120 | ~0.5 | ~60 |
| Weekly audits (security + deps + E2E manual) | ~12 | ~8 | ~96 |
| **Publishing scheduler (GHA)** | **0** | — | **0 (was ~4,300–8,600)** |
| **Typical total** | | | **~3,000–3,500** (down from **~12,000+** with GHA publishing cron) |

Active development days with frequent PR pushes remain the largest controllable cost. Publishing no longer contributes to GHA usage.

## High-frequency cron audit

| Workflow | Schedule | Status |
|----------|----------|--------|
| Publishing Scheduler | — | **Removed** — Vercel Cron only |
| Social Analytics Scheduler | Every 6 hours | OK |
| Playwright E2E | — | Manual / `run-e2e` label only |
| Scheduled Security Audit | Weekly Monday | OK |
| Scheduled Dependency Review | Weekly Monday | OK |

No GitHub Actions workflow uses a sub-hourly cron.
