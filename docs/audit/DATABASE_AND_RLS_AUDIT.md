# Database & RLS Audit

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

---

## Prisma schema overview

| Metric | Value |
|--------|-------|
| Models | 632 |
| Enums | 489 |
| Schema lines | 21,621 |
| Migrations | 82 |
| Migration validation | PASS |
| Fresh deploy test | PASS (all 82 on empty PostgreSQL) |

---

## Models by domain (approximate grouping)

| Domain | Example models | Est. count |
|--------|----------------|------------|
| CORE / Auth | UserProfile, SecurityAuditLog | ~10 |
| ORGANISATION | Organisation, OrganisationMembership, Invitation | ~8 |
| BRAND | Brand, BrandProfile, BrandPersona, BrandVoiceRule | ~25 |
| CONTENT | ContentItem, ContentVariant, ContentRevision, ContentSchedule | ~30 |
| DAM | DigitalAsset, DigitalAssetVersion, DigitalAssetProcessingJob | ~15 |
| KNOWLEDGE | KnowledgeBase, KnowledgeEntry, KnowledgeDocument | ~10 |
| CAMPAIGN | Campaign, CampaignChannel, CampaignKpi, ContentCampaign (legacy) | ~20 |
| CALENDAR | CalendarEvent | ~1 |
| PUBLISHING | PublishingJob, PublishingAttempt, Publication, PublicationAttempt | ~8 |
| PROVIDER | ProviderConnection, ProviderCredential, ProviderHealth | ~15 |
| OAUTH | OAuthTransaction | ~2 |
| ANALYTICS | AnalyticsFact, AnalyticsDataSource, AnalyticsSnapshot, SocialPostMetric | ~40 |
| AUTOMATION | AutomationWorkflow, AutomationExecution, MarketingAutomationJourney | ~25 |
| AI | AIRequest, AIExecution, AgentPlatformRun, PromptTemplate | ~15 |
| ADVERTISING | AdvertisingPlan, AdvertisingCreative, AdvertisingGoogleAds* | ~50 |
| CRM | Lead, Opportunity, CrmPipeline, CrmTask | ~40 |
| SEO | SeoSite, SeoCrawlRun, SeoKeyword, SeoBrief | ~35 |
| NOTIFICATIONS | Notification, NotificationDigest, CommentThread | ~15 |
| WAREHOUSE | MarketingWarehouse*, Tracking* | ~25 |
| BILLING | BillingCustomer, BillingSubscription, Entitlement | ~10 |
| AUDIT | AuditLog, ProviderAuditEvent | ~5 |
| OTHER | Forms, Experiments, Growth, Executive | ~50+ |

**Note:** Exact per-domain counts overlap due to cross-domain relations.

---

## Schema concerns

### Duplicate / overlapping concepts

| Issue | Models | Risk |
|-------|--------|------|
| Legacy vs canonical campaigns | `ContentCampaign` vs `Campaign` | MEDIUM — both active |
| Dual publishing | `ContentSchedule`/`PublishingJob` vs `Publication` | HIGH — product confusion |
| Dual connections | `SocialConnection` vs `ProviderConnection` vs `ConnectorAccount` | HIGH |
| Dual automation | `AutomationWorkflow` vs `MarketingAutomationJourney` | MEDIUM |

### Tenant ownership

- Most tenant-scoped models include `organisationId`
- Brand-scoped models include `brandId` + relation to Brand
- **Gap:** No database-enforced tenant isolation (see RLS section)

### Indexes and constraints

- Migration validation passes ordering and DDL checks
- Duplicate migration timestamps exist (same day, different stages) but deploy succeeds
- Example: `20260805120000_knowledge_base` and `20260805120000_stage_1_campaigns_core` — both applied

### Orphan / questionable models

- Large schema makes orphan detection manual; several Stage models have services but limited UI
- `VisualProject` / `VisualGeneration` — mock image pipeline
- Multiple `*Snapshot` and `*ImportBatch` tables — warehouse/analytics scaffolding

---

## Migration health (Phase 9)

| Check | Result |
|-------|--------|
| Ordering | PASS (82 sequential) |
| validate-migrations.mjs | PASS |
| Schema ↔ migration sync | PASS (fresh deploy) |
| Destructive migrations | Present in history (expected for evolution) |
| Raw SQL | Used in RLS migration, some stage migrations |
| Supabase-specific SQL | RLS migration uses conditional `pg_roles` checks |
| PostgreSQL role assumptions | RLS migration checks role existence before REVOKE |
| Duplicate timestamps | 6 pairs on same dates — **deploy still succeeds** |

### Fresh database test

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cresco_audit_fresh
npx prisma migrate deploy
→ 82 migrations applied, 0 failures
```

---

## RLS implementation (Phase 10)

**Migration:** `prisma/migrations/20260811120000_supabase_rls_hardening/migration.sql`

### What it does

1. `ENABLE ROW LEVEL SECURITY` on all existing `public` tables
2. `REVOKE ALL` from `anon`, `authenticated`, `service_role` (when roles exist)
3. `REVOKE EXECUTE ON ALL FUNCTIONS` from PUBLIC
4. Event triggers for new tables/functions
5. Hardens `_prisma_migrations`

### What it does NOT do

- No per-tenant `USING (organisation_id = ...)` policies
- No `FORCE ROW LEVEL SECURITY` (Prisma `postgres` owner bypasses RLS)
- Does not protect against application-layer tenant bugs

### Validation

- `npm run validate:rls-security` — PASS
- `tests/database/rls-security.test.ts` — PASS
- `docs/SUPABASE_RLS_INVENTORY.json` — inventory artifact

### CI PostgreSQL compatibility

- Migration uses portable `pg_roles` existence checks
- Compatible with CI Postgres 16 (verified by database tests)

### Security interpretation

| Layer | Tenant isolation |
|-------|------------------|
| Supabase Data API (anon/auth) | **BLOCKED** (no grants) |
| Prisma application | **App-layer only** — REVIEW |
| Direct DB access | Bypasses RLS as table owner |

**Verdict:** RLS is **defense-in-depth against Supabase PostgREST exposure**, not multi-tenant row security.

---

## Prisma validate

```
npx prisma validate → PASS
```

---

## Recommendations (document only)

1. Document canonical models (Campaign vs ContentCampaign; Publication vs PublishingJob)
2. Consider schema modularization (Prisma multi-file or domain packages)
3. Evaluate per-tenant RLS if Supabase direct access is ever enabled
4. Audit duplicate migration timestamps for future conflict risk
