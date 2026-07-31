# V1 Release Checklist

Comprehensive pre-launch checklist for V1 (Stages 1–6).

## CI / build gates

- [x] `npm run lint` passes (0 errors; 92 warnings acceptable for V1)
- [x] `npm run test:unit` passes (1030 tests, 130 files)
- [x] `npm run test:integration` passes (306 tests, 46 files)
- [x] `npx prisma validate` passes
- [x] `npm run validate:migrations` passes (59 migrations)
- [ ] `npm run typecheck` passes — **49 errors remaining** (Prisma Json, Stage 6 services)
- [ ] `npm run build` passes — **fix lifecycle handler exports in progress**
- [ ] Dependency audit clean (`npm run audit:deps`)
- [ ] Secret scan clean

## Database

- [ ] `npm run db:migrate:deploy` on staging
- [ ] `npm run db:migrate:deploy` on production (during release window)
- [ ] Pre-migration backup confirmed (see `V1_BACKUP_RECOVERY.md`)
- [ ] Connection pooling configured (`DATABASE_URL` pooled, `DIRECT_URL` direct)

## Environment variables

### Required (all environments)

```
DATABASE_URL, DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
APP_URL
```

### Production restrictions

```
ALLOW_TEST_AUTH=false
ALLOW_AI_DIAGNOSTICS=false
ALLOW_DEV_SEED=unset
```

### Optional per feature

```
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
ADVERTISING_EMERGENCY_SHUTDOWN=false
SEO_ENGINE_SHUTDOWN=false
Email provider credentials (per tenant)
Advertising provider OAuth (per tenant)
AI provider keys (OpenAI, Anthropic, etc.)
```

## Security

- [x] Tenant isolation verified (`tests/unit/v1-tenant-isolation.test.ts`)
- [x] No autonomous send/launch/publish paths
- [x] Email suppression cannot be bypassed
- [x] OAuth credentials encrypted at rest
- [x] Form public endpoint tenant-resolved server-side
- [ ] OAuth redirect URIs configured for production domain
- [ ] CSP headers verified in staging
- [ ] Rate limits active on auth and public endpoints

## Documentation

- [x] `V1_PRODUCTION_READINESS.md` — release decision documented
- [x] `V1_KNOWN_LIMITATIONS.md` communicated to beta users
- [x] `V1_BETA_SCOPE.md` agreed with stakeholders
- [x] Runbooks accessible to on-call team
- [ ] Beta agreement signed for external pilots

## Functional validation — V1 E2E scenario

Documented end-to-end scenario (manual sign-off required; not fully automated):

### Foundation (Stage 1)
1. [ ] Sign up / log in with OAuth
2. [ ] Complete onboarding wizard
3. [ ] Create brand knowledge entries
4. [ ] Upload marketing asset

### Analytics (Stage 3)
5. [ ] Create tracking property → events in warehouse
6. [ ] Connect GSC → search metrics appear
7. [ ] Run attribution model → credits calculated
8. [ ] Executive dashboard → KPIs show Available/Unavailable correctly
9. [ ] AI analyst → evidence-linked findings

### SEO (Stage 4)
10. [ ] Verify SEO site domain
11. [ ] Run crawl → issues detected
12. [ ] Generate SEO brief → approval workflow
13. [ ] Rank tracking project created

### Advertising (Stage 5)
14. [ ] Create campaign plan with versioning
15. [ ] Generate creative with compliance scan
16. [ ] Complete launch approval gates (do not launch on client account without app review)
17. [ ] Budget pacing dashboard shows data

### CRM & Revenue Ops (Stage 6)
18. [ ] Create CRM lead manually
19. [ ] Publish lead capture form → submit from allowed origin → lead created
20. [ ] Move opportunity through pipeline stages
21. [ ] Create and complete CRM task
22. [ ] Configure email domain (staging provider)
23. [ ] Create email campaign → approval → launch (test list only)
24. [ ] Create automation journey → enroll lead → verify consent gate
25. [ ] Activate lead scoring model → score calculated
26. [ ] Run lifecycle agent review → recommendation with evidence → approve action (no auto-send)

### Cross-cutting
27. [ ] Cross-tenant access denied for foreign brandId
28. [ ] Suppression blocks marketing email to unsubscribed address
29. [ ] `GET /api/readiness` returns 200 with all checks pass/warn

## Observability

- [ ] `/api/health` monitored externally
- [ ] `/api/readiness` monitored externally
- [ ] Log drain connected to SIEM/log platform
- [ ] Error monitor wired (Sentry/Datadog or equivalent)
- [ ] Launch monitoring plan reviewed (`V1_LAUNCH_MONITORING.md`)

## Provider setup

- [ ] Email provider configured for beta tenants
- [ ] Stripe webhook registered (if revenue enabled)
- [ ] Advertising OAuth on test accounts only
- [ ] Social OAuth on test accounts only
- [ ] Meta app review status documented for non-owned accounts

## Rollback readiness

- [ ] Previous production deployment identified in Vercel
- [ ] `V1_ROLLBACK_PLAN.md` reviewed by on-call
- [ ] Emergency shutdown flags documented:
  - `ADVERTISING_EMERGENCY_SHUTDOWN=true`
  - `SEO_ENGINE_SHUTDOWN=true`

## Sign-off

| Role | Decision | Name | Date |
|------|----------|------|------|
| Engineering | V1 READY WITH RESTRICTIONS | | |
| Security | No critical findings | | |
| Product | Beta scope approved | | |
| Operations | Runbooks reviewed | | |
| Legal/Privacy | DSR manual procedure accepted | | |

## Post-release (first 48 hours)

- [ ] Monitor error rate and readiness (see `V1_LAUNCH_MONITORING.md`)
- [ ] Verify email deliverability on test sends
- [ ] Review audit logs for anomalous access
- [ ] Confirm no cross-tenant data exposure reports
- [ ] Schedule post-launch review meeting
