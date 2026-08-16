# Product Gap Analysis

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

---

## If we gave this to a paying marketing team TODAY

### What they could genuinely accomplish

1. **Workspace setup** — sign up, create org/brand, invite team
2. **Campaign planning** — create campaigns, channels, KPIs, members
3. **Content operations** — draft, review, approve content with compliance checks
4. **Calendar planning** — view/manage calendar events, see projected publish slots
5. **CRM operations** — manage leads, pipelines, opportunities, tasks, forms
6. **SEO workflow** — crawl sites, research keywords, generate briefs, on-page analysis
7. **Advertising planning** — plans, creatives, audiences, budgets (with manual connector setup)
8. **Rule-based insights** — lifecycle agent, optimisation agent, compliance agent
9. **Marketing automation journeys** — build and run journey graphs (with limitations)
10. **Email via Resend** — if API key configured

### What would fail

1. **Connecting real Instagram/TikTok/LinkedIn/Facebook/YouTube/X accounts**
2. **Publishing to real social platforms** (mock tokens from connect flow)
3. **Scheduling posts from Content Studio UI**
4. **Using `/publishing` for real posts** (mock gateway)
5. **Enabling most integrations catalogue providers** (disabled)
6. **OAuth token refresh in production** (mock exchange)
7. **Marketing data sync to populate analytics** (mock sync adapters)
8. **Social inbox engagement** (all mock)
9. **Automation on business events** (no emitters)
10. **AI generation without manual API key setup** (silent mock)

### What would require manual work

1. Configure all environment secrets (Supabase, DB, encryption, worker tokens, LLM keys)
2. Run publishing scheduler via external cron/script
3. Run SEO crawl, DAM processing, notification digest workers
4. Set up paid ad connector OAuth outside standard connect flow
5. Interpret misleading UI (comingSoon nav, social stub page)
6. Choose correct publishing path (API vs UI)
7. Monitor job failures via operations pages (no alerting)

### What looks functional but is not

| Surface | Reality |
|---------|---------|
| `/social/connections` connect buttons | Mock OAuth tokens |
| `/publishing` composer | Mock social/ad gateway |
| `/integrations` provider cards | Definitions disabled |
| `/agents` (nav says coming soon) | Runs work but MOCK LLM; actions not applied |
| `/automation-engine` | Manual execute only; events not wired |
| Analytics dashboards | Often empty without sync jobs |
| AI content generate | Mock text without keys |

---

## Launch blockers

1. Real social OAuth + token lifecycle
2. Unified publishing product path
3. Provider enablement for customer connect
4. Background worker infrastructure
5. Production LLM configuration enforcement
6. E2E validation against provider sandboxes

---

## Enterprise blockers

1. No per-tenant database RLS
2. No SSO/SAML
3. Limited admin/ops centre
4. No centralized observability/APM
5. No SLA-grade job monitoring
6. 632-model schema complexity without domain boundaries
7. Audit trail present but not export/compliance packaged

---

## Charging customers today?

**No.** Core value proposition (connect → publish → measure → optimize) breaks at connection and sync layers.

---

## Production launch?

**No.** Requires P0 items in MASTER_BACKLOG.md.

---

## Competitive positioning gap

The platform has **breadth** (CRM + SEO + Ads + Content + Analytics in one codebase) but **depth** is inconsistent. Competitors would win on:
- Reliable social publishing
- Live analytics dashboards
- One-click integrations
- Production automation triggers
