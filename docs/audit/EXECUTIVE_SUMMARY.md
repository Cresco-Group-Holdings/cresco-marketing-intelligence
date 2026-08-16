# CRESCO MARKETING INTELLIGENCE — INTERNAL PLATFORM AUDIT

**Repository:** Cresco-Group-Holdings/cresco-marketing-intelligence  
**Main SHA:** `8910740bab558d5639d256c86d9ee00d0b47535e`  
**Audit date:** 2026-08-16  
**Auditor mode:** Code-only forensic reconstruction (no README/PR-title reliance)

---

## OVERALL COMPLETION: **62%**

Breadth of modules implemented in code (models, services, routes, UI). Many areas lack real provider integration or end-to-end product wiring.

## PRODUCTION READINESS: **4.2 / 10**

CI/build/migrations are healthy. Real customer workflows blocked by mock OAuth, dual publishing paths, missing event wiring, and limited live provider coverage.

---

## BUILT AND WORKING (end-to-end with mocks or internal DB)

- Workspace onboarding, org/project/brand hierarchy, Supabase auth
- Canonical campaigns CRUD with lifecycle, channels, KPIs, members
- Content studio: create, edit, review, approve, compliance checks
- Content calendar: CRUD, projection from schedules/tasks, conflict detection
- Organic publishing pipeline (schedule → job → worker → real HTTP adapters) — **tested with mocked provider HTTP**
- Paid advertising campaign management APIs (Google/Meta/LinkedIn/TikTok) — **real API clients exist**
- CRM: leads, pipelines, opportunities, tasks, forms, lead scoring
- SEO suite: crawler, keywords, competitors, briefs, on-page, internal links
- Marketing data warehouse ingestion and normalization (schema + services)
- Notifications, inbox collaboration, comments (in-app)
- Resend email provider integration (real adapter)
- AI request pipeline with cost controls — **defaults to MOCK without API keys**
- Rule-based lifecycle agent, advertising optimisation agent, compliance agent
- Automation Engine: workflow CRUD, manual dispatch, action execution
- Marketing Automation journeys (separate from Automation Engine)
- Provider platform gateway, OAuth scaffolding, credential vault (encryption)
- Billing/Stripe scaffolding
- RLS hardening migration (Supabase Data API lockdown)

## BUILT BUT INCOMPLETE

- OAuth/credential lifecycle (auth URLs real; token exchange/refresh/revoke mocked)
- Provider connections UI (definitions mostly `enabled: false`)
- Stage 13 marketing data sync (mock sync adapters)
- Social analytics pull (real adapters; scheduler via GHA every 6h)
- Publishing scheduler (Vercel cron dispatches daily; publishing needs worker token + external trigger)
- Agent Platform (runs complete; proposed actions never auto-executed)
- Analytics dashboards (canonical facts model; limited live ingestion)
- DAM processing jobs (API exists; cron not on Vercel)
- Executive dashboard, growth intelligence (partial data dependencies)
- Content scheduling UI (API exists; Content Studio does not call schedule endpoint)

## BUILT BUT DISCONNECTED

- `/publishing` Publication Platform UI → mock-social/mock-advertising gateway (Path B)
- Organic publish path (Path A: ContentSchedule → PublishingJob) not linked from main publishing UI
- Automation Engine: no domain event emitters; SCHEDULE triggers never executed
- AI Agents nav marked `comingSoon` while `/agents` page exists
- Calendar nav marked `comingSoon` while `/calendar` is fully implemented
- `/social` landing page claims publishing "later stages" despite backend completion
- Legacy connector OAuth (`/api/connectors`) parallel to Stage 12 integrations
- Two revoke paths for provider connections (legacy vs Stage 12)

## MOCK / PLACEHOLDER

- Social OAuth connection adapters (all 6 platforms → `mock-social-adapter`)
- Social inbox adapters (all mock)
- Platform registry adapters: mock-advertising, mock-crm, mock-social only
- OAuth token exchange/refresh/revoke in `oauth-adapter-registry.ts`
- Stage 13 sync adapters (all mock pages)
- AI text/image generation without API keys (MockAIProvider)
- Publication composer "Publish post (mock social)"
- Visual studio image generation (mock provider)

## NOT BUILT (for production customer use)

- Real OAuth token exchange for Meta, Google, LinkedIn, TikTok, etc.
- Live end-to-end organic social publish with real customer tokens
- Unified production provider enablement (30 definitions, 2 enabled + mocks)
- Per-tenant database RLS (only API-role lockdown exists)
- Event-driven automation (triggers defined but not emitted)
- External calendar sync (Google/Outlook contracts only)
- Enterprise SSO, SOC2 controls beyond basic audit logs
- Production observability (no Sentry/Datadog; structured logs partial)

## BROKEN / HIGH-RISK

- No P0 code failures in test suite on main
- **Architectural risk:** tenant isolation relies entirely on application layer; Prisma bypasses RLS
- **Product risk:** customers connecting social accounts get mock tokens
- **Operational risk:** most background jobs not on Vercel cron; require external workers
- **Security review:** `executive/preferences` lacks RBAC permission; shared report tokens are public

---

## P0 LAUNCH BLOCKERS

1. **Real social OAuth** — connect flow uses mock adapters only (`src/lib/social/bootstrap.ts`)
2. **Provider enablement** — 28/30 provider definitions disabled; no production connect path
3. **Publishing path confusion** — two pipelines; product UI uses mock gateway
4. **Background worker deployment** — publishing, SEO crawl, DAM, digest jobs need secured worker infra
5. **AI defaults to mock** — no enforced production LLM configuration
6. **No live E2E validation** — organic publish never verified against real provider sandboxes in CI

---

## MODULE COMPLETION MATRIX

| Module | Backend | UI | DB | Tests | Real Integration | E2E | Status | Score |
|--------|---------|----|----|-------|------------------|-----|--------|-------|
| Workspace/Auth | 9 | 8 | 9 | 8 | 8 | 7 | FUNCTIONAL | 8.0 |
| Campaigns | 8 | 7 | 8 | 7 | N/A | 6 | FUNCTIONAL BUT INCOMPLETE | 7.2 |
| Content Studio | 8 | 7 | 8 | 7 | N/A | 5 | FUNCTIONAL BUT INCOMPLETE | 7.0 |
| Content Calendar | 8 | 8 | 8 | 8 | N/A | 6 | FUNCTIONAL BUT INCOMPLETE | 7.5 |
| Organic Publishing | 8 | 4 | 8 | 8 | 3 | 3 | PARTIAL | 5.5 |
| Publication Platform | 7 | 6 | 7 | 7 | 1 | 4 | MOCK ONLY (gateway) | 4.0 |
| Paid Advertising | 8 | 7 | 8 | 7 | 6 | 4 | FUNCTIONAL BUT INCOMPLETE | 6.8 |
| Provider Platform | 7 | 5 | 8 | 8 | 2 | 3 | PARTIAL | 5.5 |
| OAuth/Credentials | 7 | 5 | 8 | 8 | 1 | 2 | MOCK ONLY (tokens) | 4.5 |
| Analytics | 7 | 6 | 8 | 6 | 4 | 3 | PARTIAL | 5.8 |
| CRM | 8 | 7 | 8 | 7 | N/A | 5 | FUNCTIONAL BUT INCOMPLETE | 7.0 |
| SEO | 8 | 7 | 8 | 7 | 5 | 4 | FUNCTIONAL BUT INCOMPLETE | 6.8 |
| DAM | 7 | 6 | 7 | 6 | 3 | 3 | PARTIAL | 5.5 |
| Knowledge Base | 7 | 6 | 7 | 6 | N/A | 4 | FUNCTIONAL BUT INCOMPLETE | 6.2 |
| AI Agents | 6 | 4 | 7 | 6 | 2 | 2 | PARTIAL | 4.5 |
| Automation Engine | 6 | 4 | 7 | 7 | N/A | 3 | PARTIAL | 5.0 |
| Marketing Automation | 7 | 7 | 7 | 7 | N/A | 5 | FUNCTIONAL BUT INCOMPLETE | 6.5 |
| Notifications | 7 | 6 | 7 | 6 | 5 | 4 | FUNCTIONAL BUT INCOMPLETE | 6.0 |
| Integrations | 6 | 5 | 7 | 7 | 2 | 2 | PARTIAL | 4.8 |
| Billing | 5 | 4 | 6 | 5 | 4 | 2 | SCAFFOLD | 4.0 |
| Security/Tenancy | 7 | N/A | 6 | 7 | 5 | 4 | FUNCTIONAL BUT INCOMPLETE | 6.0 |

---

## REAL END-TO-END CAPABILITIES (today, on main)

1. Sign up → create org → onboard brand → invite members
2. Create/manage campaigns with channels and KPIs
3. Create content → compliance review → approve
4. View/manage content calendar with projected events
5. Connect social accounts (**mock tokens only**)
6. Schedule content via API → enqueue publish job → worker calls real adapter code (**mocked in tests**)
7. Manage CRM leads, pipelines, opportunities, tasks
8. Run SEO crawl (worker-triggered), keyword research, briefs
9. Create advertising plans/creatives/audiences; launch flows with real API clients (**needs live connector tokens**)
10. Run rule-based lifecycle/optimisation/compliance agents
11. Create automation engine workflows; manual execute actions
12. Send email via Resend (when configured)

---

## TOP 10 TECHNICAL RISKS

1. Application-only tenant isolation — no per-org RLS policies
2. Mock social OAuth in production connect path
3. Dual publishing architectures (Path A real adapters vs Path B mock gateway)
4. OAuth token operations entirely mocked despite real auth URLs
5. Background jobs depend on external worker secrets not deployed on Vercel Hobby
6. 632 Prisma models — high schema complexity, migration drift risk
7. AI silently falls back to mock without operator visibility
8. Automation Engine triggers never emitted from domain services
9. Legacy + Stage 12 integration APIs coexist with different revoke semantics
10. Build OOM mitigated by skipping build-time typecheck — runtime type errors possible if CI bypassed

---

## TOP 10 PRODUCT GAPS

1. No real social account connection for customers
2. No schedule-from-UI for content publishing
3. Provider catalogue disabled — integrations page is mostly informational
4. Analytics not fed by live social/ad sync in default deployment
5. AI content generation requires manual API key setup; no in-product model management
6. Automation Engine cannot run on real business events
7. Inbox/social engagement entirely mock
8. Calendar external sync not implemented
9. Misleading navigation (`comingSoon`, outdated social landing)
10. No customer-facing status for job failures / publish retries

---

## RECOMMENDED NEXT STAGES

1. **Foundation repair** — unify publishing paths; enable real OAuth adapters; worker deployment
2. **Organic E2E** — real connect → schedule UI → publish → result → metrics
3. **Provider productionization** — enable providers; real token exchange; connection health
4. **Analytics ingestion** — wire sync schedulers; dashboard from live data
5. **Automation wiring** — emit domain events; schedule runner
6. **AI production config** — require keys in prod; operator diagnostics
7. **UX truthfulness** — nav labels, social hub, publishing UI alignment
8. **Production hardening** — observability, tenant RLS review, security gaps

---

## ANSWERS

| Question | Answer |
|----------|--------|
| **1. % of intended platform built?** | ~62% by module breadth; ~45% by depth |
| **2. % genuinely usable?** | ~35% (internal teams with API keys + manual ops) |
| **3. % production-ready?** | ~15% (auth, workspace, CRM, SEO, content, campaigns) |
| **4. Can a real customer use it today?** | **No** — social connect and provider integrations are mock/disabled |
| **5. Can we charge for it today?** | **No** — core marketing workflows fail at connection/publish layer |
| **6. Exact launch blockers?** | See P0 list above |
| **7. What should engineering work on next?** | Real OAuth + unified publishing + worker infra |
| **8. Major tasks remaining?** | ~35–45 consolidated backlog items (see MASTER_BACKLOG.md) |

---

See companion documents in `docs/audit/` for full evidence.
