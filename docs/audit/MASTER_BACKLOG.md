# Master Backlog — Consolidated from Audit

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

Priorities: **P0** launch blockers | **P1** V1 required | **P2** post-V1 | **P3** enhancement

Complexity: **S** <1 week | **M** 1–2 weeks | **L** 2–4 weeks | **XL** 4+ weeks

---

## P0 — LAUNCH BLOCKERS

| ID | Module | Problem | Evidence | Business impact | Solution | Dependencies | Size |
|----|--------|---------|----------|-----------------|----------|--------------|------|
| P0-001 | OAuth/Social | Social connect uses mock adapters only | `src/lib/social/bootstrap.ts` registers only `mock-social-adapter` | Customers cannot connect real accounts | Implement real OAuth adapters per platform; register in bootstrap | Provider credentials, redirect URIs | XL |
| P0-002 | OAuth | Token exchange/refresh/revoke mocked | `oauth-adapter-registry.ts` lines 166–184 | Connections appear valid but tokens are fake | Implement real token exchange per OAuth provider definition | P0-001, env secrets | XL |
| P0-003 | Publishing | Dual publishing paths; UI uses mock gateway | `/publishing` → mock-social; Path A not in UI | Users publish to nowhere | Unify on ContentSchedule path OR wire Publication platform to real adapters | P0-001 | L |
| P0-004 | Publishing | No schedule UI in Content Studio | `scheduling-service.ts` API exists; no UI call | Cannot schedule posts | Add schedule action to content detail/studio | P0-003 | M |
| P0-005 | Workers | Publishing scheduler not on Vercel cron | Only `daily-dispatch`; publishing needs worker token | Scheduled posts never publish | Deploy worker cron (GHA or external) with `PUBLISHING_WORKER_TOKEN` | Infra | M |
| P0-006 | Providers | 28/30 definitions `enabled: false` | `definitions.ts` | Integrations page non-functional | Enable providers progressively with real adapters | P0-002 | L |
| P0-007 | AI | Silent mock LLM fallback | `model-registry.ts` fallback to mock-text-v1 | AI features appear broken/wrong | Require API keys in production; surface diagnostic in UI | Env config | M |
| P0-008 | E2E | No live provider sandbox validation | Stage 2 checkpoint defers live E2E | Unknown production failures | Add sandbox E2E suite (opt-in CI label) | P0-001 | L |

## P1 — REQUIRED FOR V1

| ID | Module | Problem | Evidence | Business impact | Solution | Dependencies | Size |
|----|--------|---------|----------|-----------------|----------|--------------|------|
| P1-001 | UX | Calendar nav `comingSoon` but page works | `dashboard-nav.ts` | User confusion | Remove comingSoon flag | — | S |
| P1-002 | UX | Social landing outdated | `/social/page.tsx` stub text | Misleading product state | Update or redirect to connections | — | S |
| P1-003 | UX | AI Agents nav comingSoon | `dashboard-nav.ts` | Hidden capability | Update nav | — | S |
| P1-004 | Sync | Marketing data sync all mock | `mock-sync-adapter.ts` | Empty analytics | Implement real sync for priority providers | P0-002 | XL |
| P1-005 | Analytics | Dashboards empty without sync | Analytics UI + warehouse | No ROI visibility | Wire sync → facts → dashboard refresh | P1-004 | L |
| P1-006 | Automation | No domain event emitters | `dispatchEvent` only from API | Automations never trigger | Emit events from campaign/content services | — | L |
| P1-007 | Automation | SCHEDULE triggers not executed | `automation-engine-execution-service.ts` | Cron automations dead | Add schedule runner job | Worker infra | M |
| P1-008 | Agents | Proposed actions never executed | `agent-approval-service.ts` | AI cannot act | Implement action executor post-approval | — | L |
| P1-009 | Security | Legacy revoke leaves credentials | `provider-connection-service.ts` | Orphan secrets | Deprecate legacy path; unify on Stage 12 revoke | — | M |
| P1-010 | Security | Executive preferences no RBAC | `executive/preferences/route.ts` | Over-permissive | Add permission check | — | S |
| P1-011 | Inbox | All inbox adapters mock | `inbox-adapters.ts` | No social engagement | Real inbox adapters for top 3 platforms | P0-001 | XL |
| P1-012 | DAM | Processing worker not scheduled | `/api/digital-assets/process-due` | Assets stuck processing | Add cron/worker | Infra | M |
| P1-013 | SEO | Crawl worker external only | `seo-crawl/process-due` | Crawls don't run | Schedule crawl worker | Infra | M |
| P1-014 | Notifications | Digest worker external | `notifications/digest/process-due` | No email digests | Schedule digest worker | Infra | S |
| P1-015 | Integrations | Dual OAuth stacks | connectors vs integrations APIs | Maintenance burden | Consolidate on Stage 12 | P0-002 | L |
| P1-016 | Schema | ContentCampaign vs Campaign overlap | Both in schema | Data confusion | Migration plan to deprecate legacy | — | L |
| P1-017 | Billing | Stripe scaffold only | `stripe-billing-provider.ts` | Cannot charge | Complete checkout/portal/webhooks | Stripe account | L |
| P1-018 | Observability | No APM/error tracking | No Sentry/Datadog | Cannot diagnose prod | Integrate error tracking | — | M |

## P2 — IMPORTANT AFTER V1

| ID | Module | Problem | Evidence | Solution | Size |
|----|--------|---------|----------|----------|------|
| P2-001 | Calendar | External sync not implemented | `external-providers.ts` contracts only | Google/Outlook sync | XL |
| P2-002 | AI | Image generation mock only | `image-providers.ts` | Real image provider | L |
| P2-003 | Schema | 632-model monolith | `schema.prisma` 21k lines | Modularize schema | XL |
| P2-004 | Tenancy | No per-org RLS | RLS migration lockdown only | Evaluate tenant policies | L |
| P2-005 | E2E | Playwright skipped by default | CI policy | Label-gated full E2E on release | M |
| P2-006 | Publishing | Inbox after publish | Mock inbox | Connect publish → inbox ingest | L |
| P2-007 | Advertising | Launch flow complexity | Multi-step approvals | Simplify happy path UX | M |
| P2-008 | CRM | Sensitive field UX | Permissions exist | UI gating audit | M |
| P2-009 | Reports | Public share tokens | `reports/shared/[token]` | Expiry + audit | S |
| P2-010 | Admin | Limited ops centre | `/operations` only | Unified admin dashboard | L |

## P3 — ENHANCEMENT

| ID | Module | Problem | Solution | Size |
|----|--------|---------|----------|------|
| P3-001 | Code | `requirePermission` unused | Remove or adopt | S |
| P3-002 | Code | 139 lint warnings | Clean unused imports | M |
| P3-003 | Docs | Stage docs vs code drift | Auto-generate inventory | M |
| P3-004 | CI | Prisma generate slow in postinstall | Cache or prebuild | M |
| P3-005 | UX | 39 nav items overwhelming | Grouping/permissions-based nav | M |
| P3-006 | AI | Native JSON mode per provider | Provider-specific structured output | M |
| P3-007 | Providers | Microsoft Ads scaffold | Full adapter | L |
| P3-008 | Enterprise | SSO/SAML | Auth provider integration | XL |

---

## Deduplicated root causes

1. **Mock adapter registration** → P0-001, P0-002, P1-004, P1-011
2. **Worker infra gap** → P0-005, P1-012, P1-013, P1-014, P1-007
3. **Dual architecture** → P0-003, P1-015, P1-016
4. **UX truthfulness** → P1-001, P1-002, P1-003

**Estimated major tasks remaining:** 38 items (8 P0, 18 P1, 10 P2, 8 P3)
