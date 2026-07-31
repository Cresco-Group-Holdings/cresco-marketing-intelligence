# V1 Tenant Isolation Review

Cross-stage audit of tenant boundary enforcement before V1 release.

## Summary

| Layer | Status | Mechanism |
|-------|--------|-----------|
| Data model | ✅ Pass | `organisationId` on all tenant tables; brand-scoped tables include `brandId` |
| Service layer | ✅ Pass | `brandService.getById(organisationId, brandId)` on every brand operation |
| API layer | ✅ Pass | `withApiHandler` + permission checks; organisation context required |
| Public endpoints | ✅ Pass | Tenant resolved server-side (`publicFormId`, tracking property key) |
| Cache keys | ✅ Pass | Tenant-scoped in executive dashboard and analytics |
| AI requests | ✅ Pass | Scoped by `organisationId`; validated before execution |
| Cross-tenant mutations | ✅ Pass | Foreign brandId returns 403/404 |

**No critical cross-tenant access vulnerabilities identified.**

## Isolation model

```
Organisation
  └── Project
        └── Brand  ← primary operational boundary for marketing data
```

All queries for brand-scoped resources filter by both `organisationId` and `brandId`. Organisation-scoped resources (members, billing) filter by `organisationId` only.

## Stage-by-stage coverage

### Stage 1 — Foundation

| Area | Scoping | Tests |
|------|---------|-------|
| Workspace, RBAC | `organisationId` | `tests/unit/permissions.test.ts`, `organisation-access` |
| Brand knowledge/assets | `organisationId` + `projectId` + `brandId` | `foundation-dashboard-service` |
| Connectors | `organisationId` + `brandId` | `tests/integration/connector-service.test.ts` |
| AI requests | `organisationId` | `tests/unit/ai-request-service.test.ts` |

### Stage 2 — Social

| Area | Scoping | Tests |
|------|---------|-------|
| Social connections | `organisationId` + `brandId` | Publishing adapter tests |
| Content/scheduling | Brand-scoped | `tests/unit/social-*` |
| Marketing leads | `organisationId` + `brandId` | Lead service tests |

### Stage 3 — Analytics

| Area | Scoping | Tests |
|------|---------|-------|
| Warehouse, attribution, funnels | `organisationId` + `brandId` | `analyst-service`, `executive-service`, `funnel-service` |
| Revenue (Stripe) | `organisationId` + `brandId` via metadata | `revenue-service` |
| AI analyst | Tenant context required | `analyst-service` tenant tests |

### Stage 4 — SEO

| Area | Scoping | Tests |
|------|---------|-------|
| Crawler, keywords, briefs | `organisationId` + `brandId` | `tests/unit/stage-4-seo-production.test.ts` |
| Rank tracking | Brand-scoped projects | `rank-tracking.test.ts` |
| Internal linking | Site-scoped within brand | `internal-linking.test.ts` |

### Stage 5 — Advertising

| Area | Scoping | Tests |
|------|---------|-------|
| Campaign plans, creatives, audiences | `organisationId` + `brandId` | `stage-5-advertising-production.test.ts` |
| Provider accounts | Brand-scoped connections | Per-provider management tests |
| Budget governance | Organisation + brand limits | `advertising-budget-governance.test.ts` |

### Stage 6 — CRM & Revenue Ops

| Module | Service file | Integration test |
|--------|-------------|------------------|
| CRM | `crm-service.ts` | `tests/integration/crm-routes.test.ts` |
| Forms | `lead-capture-form-service.ts` | `tests/integration/form-routes.test.ts` |
| Pipelines | `crm-pipeline-service.ts` | `tests/integration/crm-pipelines-routes.test.ts` |
| Tasks | `crm-task-service.ts` | `tests/integration/crm-tasks-routes.test.ts` |
| Email campaigns | `email-campaign-service.ts` | `tests/integration/email-campaigns-routes.test.ts` |
| Email infrastructure | `email-message-service.ts` | `tests/integration/email-routes.test.ts` |
| Automation | `marketing-automation-service.ts` | `tests/integration/automation-routes.test.ts` |
| Lead scoring | `lead-scoring-service.ts` | `tests/integration/lead-scoring-routes.test.ts` |
| Lifecycle agent | `lifecycle-agent-service.ts` | `tests/integration/lifecycle-agent-routes.test.ts` |

Consolidated verification: `tests/unit/v1-tenant-isolation.test.ts`

## API handler permission bindings

Stage 6 handlers verified to bind read routes to correct permissions:

| Handler | Permission |
|---------|------------|
| `crm-handler.ts` | `crm.read` |
| `email-campaigns-handler.ts` | `emailCampaigns.read` |
| `automation-handler.ts` | `automation.read` |
| `lead-scoring-handler.ts` | `leadScoring.read` |
| `lifecycle-agent-handler.ts` | `lifecycleAgent.read` |

## Public endpoint isolation

| Endpoint | Tenant resolution | Client-supplied tenant rejected |
|----------|-------------------|--------------------------------|
| `POST /api/forms/v1/[publicFormId]/submit` | `publicFormId` → form → brand | ✅ |
| `POST /api/tracking/v1/events` | Tracking property key | ✅ |
| `GET /api/health`, `GET /api/readiness` | No tenant data | N/A |

## RBAC and sensitive data

| Permission | Protects |
|------------|----------|
| `crm.viewSensitiveContact` | Email, phone contact methods |
| `crm.viewRevenue` | Revenue identity links |
| `marketingData.viewRaw` | Raw provider API responses |
| `email.manageSuppressions` | Suppression list management |

VIEWER role has read access to most modules but cannot mutate tenant data.

## Known gaps (non-critical)

| Gap | Risk | Mitigation |
|-----|------|------------|
| Suppressed leads excluded from export — deferred | Low | Manual review before bulk export |
| MarketingLead ↔ CrmLead bridge not auto-synced | Low | Separate domains; manual bridge |
| Duplicate permission keys in `permissions.ts` | Low (typecheck) | Fix before unrestricted production |

## Test references

Run tenant isolation verification:

```bash
npm run test:unit -- tests/unit/v1-tenant-isolation.test.ts
npm run test:integration -- tests/integration/crm-routes.test.ts
npm run test:integration -- tests/integration/form-routes.test.ts
npm run test:integration -- tests/integration/automation-routes.test.ts
npm run test:integration -- tests/integration/lead-scoring-routes.test.ts
npm run test:integration -- tests/integration/lifecycle-agent-routes.test.ts
```

## Sign-off

| Check | Status |
|-------|--------|
| All brand-scoped services use `brandService.getById` | ✅ Verified |
| Cross-tenant API access returns 403/404 | ✅ Integration tests |
| Public endpoints do not trust client tenant context | ✅ Verified |
| No critical findings | ✅ |
