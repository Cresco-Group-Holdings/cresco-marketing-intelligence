# Production Readiness Scores

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

Scale: 0–2 absent/broken | 3–4 scaffold | 5–6 partial | 7–8 functional gaps | 9 production | 10 mature

| Area | Score | Rationale |
|------|-------|-----------|
| **Architecture** | 5.5 | Solid patterns but dual systems (publish, OAuth, automation, connections) |
| **Frontend** | 6.0 | 339 pages; many complete; misleading nav/stubs |
| **Backend** | 7.0 | 233 services; extensive APIs; strong conventions |
| **Database** | 6.5 | 632 models deploy clean; monolith schema; overlap |
| **Organic Social** | 4.0 | Real adapter code; mock connect; no schedule UI |
| **Paid Advertising** | 6.0 | Real clients; complex flows; token-dependent |
| **Content Studio** | 7.0 | Full CRUD + compliance; schedule gap |
| **DAM** | 5.5 | Models + API; worker not deployed |
| **Knowledge Base** | 6.0 | Functional CRUD; AI retrieval partial |
| **Campaigns** | 7.5 | Stage 1 canonical model complete |
| **Calendar** | 7.5 | Full UI; nav flag wrong; no external sync |
| **Publishing** | 4.5 | Backend path good; product path mock |
| **Providers** | 4.0 | Gateway mock-heavy; definitions disabled |
| **OAuth** | 4.5 | Security good; tokens mock |
| **Analytics** | 5.5 | Schema strong; ingestion partial |
| **AI** | 5.0 | Pipeline real; mock default; actions not executed |
| **Automation** | 5.0 | Engine partial; journeys better |
| **Notifications** | 6.0 | In-app + Resend; digest worker external |
| **Security** | 6.0 | RBAC strong; tenant DB isolation weak |
| **Tenancy** | 5.5 | App-layer only |
| **RBAC** | 7.0 | 318 permissions; few gaps |
| **Testing** | 7.0 | 2052 tests pass; heavy mocking |
| **CI/CD** | 7.5 | Comprehensive gates; E2E policy skipped |
| **Vercel** | 7.0 | Lean build; OOM mitigated; worker gap |
| **Observability** | 4.0 | Audit logs; no APM |
| **UX** | 5.5 | Broad nav; disconnected surfaces |

### Aggregate

| Metric | Score |
|--------|-------|
| **Mean readiness** | **5.9 / 10** |
| **Weighted production readiness** | **4.2 / 10** (customer-facing workflows weighted) |

### Percentage estimates

| Metric | % |
|--------|---|
| Platform built (breadth) | 62% |
| Genuinely usable | 35% |
| Production-ready | 15% |
