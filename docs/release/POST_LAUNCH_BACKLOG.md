# Post-Launch Backlog

**Audit date:** 2026-08-05  
**Consolidates:** `docs/V1_POST_LAUNCH_BACKLOG.md`

Prioritised engineering backlog after V1 controlled beta launch. Not in scope for V1 freeze.

## P0 — Required for unrestricted production (READY)

| ID | Item | Effort | Owner |
|----|------|--------|-------|
| PL-001 | SaaS subscription billing (Stripe Checkout, plan management UI) | Large | Product + Engineering |
| PL-002 | Plan-tier quota enforcement (SEO, ads, AI, features) | Medium | Engineering |
| PL-003 | Automated E2E V1 scenario in default CI | Medium | Engineering |
| PL-004 | Legal review sign-off (Privacy, Terms, Cookie, DPA) | External | Legal |

## P1 — High value post-launch

| ID | Item | Effort |
|----|------|--------|
| PL-010 | Content Calendar product UI (`/calendar`) | Medium |
| PL-011 | AI Agents configuration hub (`/ai-agents`) | Large |
| PL-012 | Push notification delivery | Medium |
| PL-013 | Slack/Teams notification channels | Medium |
| PL-014 | Meta Ads app review for client accounts | External |
| PL-015 | WCAG 2.2 AA audit and remediation | Medium |
| PL-016 | Load testing and API p95 benchmarks | Medium |
| PL-017 | MarketingLead ↔ CrmLead auto-bridge | Medium |
| PL-018 | Visual drag-and-drop email builder | Large |
| PL-019 | Provider OAuth reconnect flows (Stage 12 completion) | Medium |

## P2 — Improvements

| ID | Item | Effort |
|----|------|--------|
| PL-020 | JavaScript rendering for SEO crawler | Large |
| PL-021 | Cross-currency normalisation in analytics | Medium |
| PL-022 | Seasonal anomaly detection | Medium |
| PL-023 | Distributed crawl scaling (beyond Postgres queue) | Large |
| PL-024 | Google Ads Display/PMax/Video support | Large |
| PL-025 | LinkedIn document/matched audiences | Medium |
| PL-026 | TikTok Spark Ads | Medium |
| PL-027 | Cookie policy standalone page | Small |
| PL-028 | Service status page (public) | Small |
| PL-029 | Reduce typecheck/build heap requirement | Medium |
| PL-030 | Continuous cross-tenant fuzzing in staging | Medium |

## P3 — Nice to have

| ID | Item |
|----|------|
| PL-040 | White-label / multi-region deployment |
| PL-041 | Public self-serve signup without beta agreement |
| PL-042 | PCI card storage (if ever needed beyond Stripe) |
| PL-043 | External penetration test |
| PL-044 | APM dashboard integration (Datadog/New Relic) |
| PL-045 | Chaos engineering programme |

## Technical debt

| ID | Item | Source |
|----|------|--------|
| TD-001 | Update stale counts in `docs/V1_PRODUCTION_READINESS.md` | Stage 18 audit |
| TD-002 | Consolidate duplicate connector vs integrations nav | UX review |
| TD-003 | Admin Centre as dedicated route (vs `/settings`) | Product |
| TD-004 | `.env.example` — remove empty-string override pattern | Stage 18 fix |
| TD-005 | 93 ESLint warnings — triage and reduce | CI lint |

## Monitoring backlog (first 30 days)

| ID | Item |
|----|------|
| MON-001 | Dashboard for auth failure rate |
| MON-002 | Onboarding completion funnel |
| MON-003 | Provider sync failure alerts per org |
| MON-004 | AI cost daily budget alert |
| MON-005 | Queue backlog monitoring |

## Success criteria for V1.1 (unrestricted launch)

From `RELEASE_SCORE.md` path to READY (≥ 85):

1. PL-001 + PL-002 complete (billing)
2. PL-003 complete (E2E CI)
3. PL-015 or spot-fix critical a11y issues
4. Live provider validation in staging
5. Load test on critical APIs

Estimated score uplift: +14 points → READY
