# Stage 3 Production Readiness

Audit of Tasks 3.1–3.10 (Marketing Data Warehouse through AI Marketing Analyst).

## Release decision

**READY WITH RESTRICTIONS**

Stage 3 delivers a production-grade marketing intelligence platform with documented formulas, tenant isolation, governed AI, and explicit unavailable-data handling. Restrictions apply to provider coverage, seasonal anomaly detection, and scheduled brief automation.

| Area | Status | Notes |
|------|--------|-------|
| Data warehouse (3.1) | Ready | Normalised models, freshness, quality rules |
| Event tracking (3.2) | Ready | First-party tracking, server events, consent |
| GA4 (3.3) | Ready with restrictions | Reconciliation documented; not full GA4 dashboard |
| Search Console (3.4) | Ready | Sync, opportunities, freshness disclaimers |
| Paid advertising (3.5) | Ready with restrictions | Multi-provider; mixed-currency warnings |
| Attribution (3.6) | Ready | 8 models, journeys, deterministic credits |
| Funnels (3.7) | Ready | Templates, segments, drop-off insights |
| Revenue (3.8) | Ready with restrictions | Stripe when configured; LTV requires methodology |
| Executive dashboard (3.9) | Ready | Cross-channel KPIs, unavailable-not-zero |
| AI analyst (3.10) | Ready with restrictions | Evidence-grounded; deterministic fallback |
| Tenant isolation | Ready | All queries scoped by organisation + brand |
| OAuth / webhooks | Ready | Signature verification, encrypted credentials |
| Test coverage | Ready | 677+ unit/integration tests |
| Build / typecheck | Ready | CI gates pass |

## Task audit summary

### 3.1 — Marketing data warehouse
Unified warehouse models, metric registry, freshness SLA, quality checks, manual import.

### 3.2 — First-party tracking
Tracking properties, server events, session stitching, privacy controls.

### 3.3 — GA4 integration
Connection, reconciliation service, metric comparison disclaimers.

### 3.4 — Google Search Console
Query/page sync, opportunities, 2–3 day delay documented.

### 3.5 — Paid advertising
Google Ads, Meta, LinkedIn, TikTok connectors; cost records; creative linking.

### 3.6 — Attribution engine
8 models, touchpoints, journeys, exclusions, direct-traffic policies.

### 3.7 — Funnel intelligence
Custom funnels, Cresco templates, cohort/segment analysis.

### 3.8 — Revenue intelligence
Stripe adapter, webhooks, customer mapping, MRR/CAC formulas.

### 3.9 — Executive dashboard
Cross-channel orchestration, comparisons, objectives, export.

### 3.10 — AI marketing analyst
Query planner, evidence packages, structured output, anomaly detection, action proposals.

## Beta scope recommendation

- Cresco Grants Intelligence and Capital Cresco Terminal brands
- Organisations with at least one connected data source
- Users with MARKETER role or above for sync/generate operations
- Stripe revenue optional; executive KPIs show Unavailable when not configured

## Blockers (none critical)

No unresolved critical security or accuracy issues. See `docs/STAGE_3_KNOWN_LIMITATIONS.md`.
