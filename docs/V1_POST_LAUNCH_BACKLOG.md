# V1 Post-Launch Backlog

Prioritised engineering and operational items after V1 beta launch.

## P0 — Required for unrestricted production

| Item | Category | Effort | Notes |
|------|----------|--------|-------|
| Fix 49 typecheck errors | Engineering | M | Prisma Json types, Stage 6 services, UI types, duplicate permission keys |
| Verify production build | Engineering | S | Lifecycle handler exports; `NODE_OPTIONS=--max-old-space-size=8192` |
| Automated E2E V1 scenario | Engineering | L | Documented in `V1_RELEASE_CHECKLIST.md`; Playwright or equivalent |
| Billing plan enforcement | Engineering | L | Tie SEO/ad/feature quotas to organisation plan tier |
| Duplicate permission keys fix | Engineering | S | `src/lib/tenancy/permissions.ts` lines 257–260 |

## P1 — High priority (first 30 days)

| Item | Category | Effort | Notes |
|------|----------|--------|-------|
| DSR workflow automation | Engineering + Legal | L | Ticket → identify → suppress → archive → export → document |
| Retention scheduler | Engineering | L | Automated purge per `V1_DATA_RETENTION.md` |
| Consent withdrawal automation | Engineering | M | Process `withdrawnAt`; auto-suppress and exit automations |
| MarketingLead → CrmLead bridge | Engineering | M | Auto-sync or bulk migration job |
| Suppressed leads export exclusion | Engineering | S | Enforce in export service |
| Meta app review (non-owned accounts) | Operations | L | External dependency |
| Distributed rate limiting (Redis) | Engineering | M | Replace in-memory limits for multi-instance |
| Lint warnings reduction | Engineering | M | 92 warnings; prioritise security-related |

## P2 — Medium priority (30–90 days)

| Item | Category | Effort | Notes |
|------|----------|--------|-------|
| Email ↔ attribution bridge | Engineering | M | Connect campaign metrics to attribution engine |
| Cross-currency normalisation | Engineering | L | FX rates for mixed-currency reporting |
| Seasonal anomaly detection | Engineering | M | Stage 3 analyst extension point |
| Website/social auto-capture to CRM | Engineering | M | Wire form_submit and social leads |
| Company/contact CRM import | Engineering | M | Extend beyond leads |
| Visual email builder | Product + Engineering | XL | Template-based sufficient for beta |
| Audience upload to ad providers | Engineering | L | Stage 5 deferred capability |
| Provider-side emergency pause API | Engineering | M | Call provider pause on emergency |
| Live ad policy review polling | Engineering | M | Google/Meta review status |
| Full WCAG accessibility audit | Engineering | L | Stage 1 partial accessibility |
| Audit events on all launch paths | Engineering | S | Expand `recordAdvertisingAuditEvent` coverage |

## P3 — Lower priority (90+ days)

| Item | Category | Effort | Notes |
|------|----------|--------|-------|
| Spark Ads (TikTok) | Engineering | M | Creator auth verification |
| Document ads (LinkedIn) | Engineering | M | Upload API verification |
| Performance Max / Advantage+ | Engineering | L | Google/Meta advanced campaign types |
| Multi-organisation portfolio view | Product | L | Cross-brand optimisation |
| White-label / reseller | Product | XL | Not in V1 scope |
| Real-time collaborative editing | Product | XL | |
| JavaScript rendering (SEO crawler) | Engineering | XL | Headless browser infrastructure |
| DNS rebinding protection (SEO) | Engineering | M | Stage 4 restriction |
| Warehouse event partitioning | Engineering | L | Scale for high-volume tenants |
| Scheduled brief automation | Engineering | M | Stage 3 analyst extension |
| Payment failed follow-up rules | Engineering | S | CRM billing integration |
| Bot filtering improvement (email opens) | Engineering | M | Reduce inflated open rates |

## Technical debt from typecheck errors

| File | Error category | Count (approx) |
|------|-------------|----------------|
| `src/components/crm/assistant-view.tsx` | UI type mismatches on draft objects | 11 |
| `src/components/crm/scoring-view.tsx` | Qualification status enum mismatch | 7 |
| `src/lib/crm-tasks/lifecycle.ts` | Missing `errors` property | 2 |
| `src/lib/lead-scoring/decay.ts` | Unexported `ScoringSignal` type | 3 |
| `src/lib/marketing-automation/templates.ts` | `exitReason` not in type | 8 |
| `src/lib/tenancy/permissions.ts` | Duplicate property names | 4 |
| `src/server/services/crm-follow-up-service.ts` | Prisma query types, missing includes | 10 |
| `src/server/services/crm-task-service.ts` | Generic type constraint | 1 |
| `src/server/services/lead-scoring-service.ts` | Prisma Json type | 1 |

## Operational improvements

| Item | Owner | Notes |
|------|-------|-------|
| Configure on-call rotation | Operations | Per `V1_INCIDENT_RESPONSE.md` |
| Connect log drain to SIEM | Infrastructure | Per `OBSERVABILITY.md` |
| Wire error monitor (Sentry/Datadog) | Engineering | `error-monitor.ts` abstraction ready |
| Quarterly backup restore test | Infrastructure | Per `V1_BACKUP_RECOVERY.md` |
| Beta tenant feedback survey | Product | After T+7 |
| Provider sandbox validation suite | Operations | Optional real-provider E2E |

## Success criteria for unrestricted production

- [ ] All P0 items complete
- [ ] Typecheck and build pass in CI
- [ ] E2E V1 scenario automated and passing
- [ ] 30 days stable monitoring (see `V1_LAUNCH_MONITORING.md`)
- [ ] No S1 incidents in past 30 days
- [ ] DSR procedure tested end-to-end
- [ ] Billing plan enforcement live
- [ ] Beta user feedback addressed or documented

## Related documents

- `docs/V1_KNOWN_LIMITATIONS.md`
- `docs/V1_PRODUCTION_READINESS.md`
- `docs/V1_RELEASE_CHECKLIST.md`
