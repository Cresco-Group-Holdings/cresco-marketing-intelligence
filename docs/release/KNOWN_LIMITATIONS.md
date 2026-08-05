# Known Limitations — V1 Launch

**Audit date:** 2026-08-05  
**Consolidates:** `docs/V1_KNOWN_LIMITATIONS.md` and stage-specific limitation docs

Honest inventory for beta customers. Do not market these as complete.

## Platform

| Limitation | Impact | Workaround |
|------------|--------|------------|
| No SaaS subscription billing | Cannot self-serve upgrade/downgrade | Manual tenant provisioning |
| Plan-tier quotas partial | Only email daily quotas enforced | Manual org configuration |
| E2E not in default CI | Manual smoke required per release | `SMOKE_TEST_PLAN.md` |
| Typecheck/build need 8GB heap | CI must set `NODE_OPTIONS` | Configured in CI |
| Content Calendar UI | Route exists; no calendar product | Use scheduling in Content Studio |
| AI Agents hub | Route exists; no agent config UI | Use Analyst, Assistant, Optimisation modules |

## Authentication and onboarding

| Limitation | Impact |
|------------|--------|
| Public self-serve signup | Restricted to beta agreement tenants |
| OAuth providers | Google supported; others per provider matrix |

## Content and publishing

| Limitation | Impact |
|------------|--------|
| Social publishing | Approval required; provider-specific limits |
| Video rendering | Runbook exists; failures need manual retry |
| Publishing partial success | `PARTIALLY_PUBLISHED` state requires reconciliation |

## Integrations and providers

| Limitation | Impact |
|------------|--------|
| Many providers DISABLED in UI | Mock adapters for dev/test; live requires setup |
| Meta Ads app review | Non-owned accounts cannot launch without review |
| Google Ads | Search campaigns only (no Display, PMax, Video) |
| LinkedIn | Document/matched audiences disabled |
| TikTok | Spark Ads and sandbox disabled |
| Provider OAuth reconnect | Some flows are controlled placeholders |

## Analytics and data

| Limitation | Impact |
|------------|--------|
| GSC 2–3 day delay | Stale search data |
| GA4 metric differences | Documented; not identical to GA4 UI |
| No cross-currency normalisation | Mixed-currency warnings only |
| Seasonal anomaly detection | Extension point only |
| Stripe connector | Revenue analytics only; not platform billing |

## SEO

| Limitation | Impact |
|------------|--------|
| No JavaScript rendering | SPA content not fully crawled |
| Crawl scaling | Postgres queue; in-memory rate limits |
| Plan-tier SEO quotas | Not tied to billing |

## CRM and email

| Limitation | Impact |
|------------|--------|
| MarketingLead ↔ CrmLead bridge | No auto-sync |
| Visual email builder | Template-based only |
| Consent withdrawal | Manual suppression processing |
| Multi-provider email | Requires manual setup per provider |

## AI

| Limitation | Impact |
|------------|--------|
| No autonomous actions | All material actions require human approval |
| AI cost limits | Platform-wide; not per-plan |
| Prompt injection | Mitigated by redaction; not eliminated |

## Notifications and collaboration

| Limitation | Impact |
|------------|--------|
| Push notifications | Contract only; not implemented |
| Slack/Teams delivery | Contract only; not implemented |
| Digest timezone | Respects user timezone; manual TZ config |

## Security and compliance

| Limitation | Impact |
|------------|--------|
| WCAG 2.2 AA | Not fully audited |
| Legal pages | Require counsel review before public marketing |
| Cookie policy | No standalone page |

## Performance

| Limitation | Impact |
|------------|--------|
| No load test results | API p95 not formally measured |
| Large list performance | Cursor pagination on inbox; some lists unpaginated |
| Cold start | Vercel serverless; first request may be slow |

## References

- `docs/STAGE_3_KNOWN_LIMITATIONS.md` — Analytics
- `docs/STAGE_4_KNOWN_LIMITATIONS.md` — SEO
- `docs/STAGE_5_KNOWN_LIMITATIONS.md` — Advertising
- `docs/V1_PROVIDER_MATRIX.md` — Provider capabilities
