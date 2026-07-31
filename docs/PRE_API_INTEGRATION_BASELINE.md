# Pre-API Integration Baseline

Baseline commit marking the repository state after consolidating all product-development PRs into `main`, ready for external API/provider integration.

## Baseline Identity

| Field | Value |
|-------|-------|
| **Commit** | `b80dd3cc17c2768912e6019dc7db71a357c86672` |
| **Date** | 2026-07-31 |
| **Branch** | `main` |
| **Open PR count** | 11 (superseded; pending manual closure) |

## Merged to Main

The following work was consolidated into `main` via direct merge (not individual PR merges):

### V1 Production Readiness (from `cursor/v1-production-readiness-e94c`)
- Stages 3–6 complete application layer
- Marketing data warehouse foundation (Task 3.1)
- SEO intelligence (Stage 4, Tasks 4.1–4.10)
- Advertising platform (Stage 5, Tasks 5.1–5.10)
- CRM foundation (Stage 6, Tasks 6.1–6.10)
- V1 production readiness audit and documentation

### Stage 2 Remaining Features (merged locally)
- Task 2.13: Unified Social Inbox (`cursor/unified-social-inbox-e94c`)
- Task 2.15: Notifications and operational failure recovery (`cursor/notifications-failure-recovery-e94c`)
- Task 2.17: Social compliance and brand safety agent (`cursor/social-compliance-agent-e94c`)
- Task 2.18: Team content operations (`cursor/team-content-operations-e94c`)

## Superseded / Closed PRs

These PRs are fully contained in the consolidated `main` merge and should be closed:

| PR | Title | Reason |
|----|-------|--------|
| #38 | Task 3.1 Marketing Data Warehouse | Included in v1-production-readiness |
| #51 | Marketing attribution engine | Included in v1-production-readiness |
| #52 | Search Console integration | Included in v1-production-readiness |
| #53 | First-party analytics | Included in v1-production-readiness |
| #54 | Funnel conversion intelligence | Included in v1-production-readiness |
| #57 | Revenue unit economics | Included in v1-production-readiness |
| #60 | AI Marketing Analyst | Included in v1-production-readiness |
| #63 | Keyword intelligence | Included in v1-production-readiness |
| #78 | CRM Tasks, Activities | Included in v1-production-readiness |
| #79 | Email Infrastructure | Included in v1-production-readiness |
| #80 | Email Campaigns | Included in v1-production-readiness |

Previously merged into stacked branches (now in main):
- #81–#84 (Stage 6.7–6.10 stacked chain)

## Test Results

| Suite | Count | Status |
|-------|-------|--------|
| Unit tests | 1,184 | PASS |
| Integration tests | 337 | PASS |
| **Total** | **1,521** | **PASS** |

## Migration Count

64 Prisma migrations validated successfully.

## Build Verification

| Check | Status |
|-------|--------|
| `npm run lint` | PASS (0 errors, 101 warnings) |
| `npm run typecheck` | PASS |
| `npm run test:unit` | PASS (1,184 tests) |
| `npm run test:integration` | PASS (337 tests) |
| `npm run validate:migrations` | PASS |
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npm run audit:secrets` | PASS |
| `npm run build` | PASS |

## Vercel Deployment

Production deployment triggered by push to `main`. Preview deployments require `DATABASE_URL` and `DIRECT_URL` environment variables configured in Vercel project settings.

## Known Restrictions

See consolidated limitation documents:
- `docs/KNOWN_LIMITATIONS.md` — Stage 1–3 overview
- `docs/STAGE_2_KNOWN_LIMITATIONS.md`
- `docs/STAGE_3_KNOWN_LIMITATIONS.md`
- `docs/STAGE_4_KNOWN_LIMITATIONS.md`
- `docs/STAGE_5_KNOWN_LIMITATIONS.md`
- `docs/V1_KNOWN_LIMITATIONS.md`

Key restrictions at baseline:
- Production OAuth adapters not wired (mock adapters in bootstrap)
- No usage-based billing or subscription management
- AI uses mock provider when real providers unconfigured
- External API credentials not required for core build/tests

## Provider Integrations (Mocked/Disabled)

| Provider | Status | Notes |
|----------|--------|-------|
| Google OAuth | Mock | `src/lib/social/bootstrap.ts` |
| Meta OAuth | Mock | Bootstrap mock adapters |
| LinkedIn OAuth | Mock | Bootstrap mock adapters |
| TikTok OAuth | Mock | Bootstrap mock adapters |
| GA4 | Schema only | Warehouse connector stub |
| Google Ads | Schema only | Campaign management UI; no live API |
| Google Search Console | Schema only | Connector stub |
| Email providers | Configurable | Requires tenant setup per provider |
| AI providers | Mock default | OpenAI/Anthropic when configured |

## External API Credentials

**Not required** for core build, unit tests, integration tests, or local development. Tests use mocked providers and in-memory/test database fixtures.

## Rollback Point

To revert to pre-consolidation state:

```bash
git checkout 252b911175fc12a06289da55a16572c3f615eb15
```

This is the last `main` commit before v1 production readiness merge.

## Decision

**READY FOR API INTEGRATION**

All product-development stages (1–6) and V1 production readiness are consolidated on `main`. Build passes, tests pass, migrations valid, no secrets committed. External provider wiring can begin from this baseline.
