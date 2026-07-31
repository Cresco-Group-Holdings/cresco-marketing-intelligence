# Stage 6 Production Readiness

Audit of Tasks 6.1–6.9 (CRM, Forms, Pipeline, Email, Automation, Scoring, Lifecycle Agent) before customer or production use.

## Release decision

**READY WITH RESTRICTIONS**

Stage 6 delivers a tenant-safe CRM and revenue-operations layer with human-in-the-loop messaging, deterministic lead scoring, and evidence-grounded lifecycle recommendations. Restrictions apply to billing plan enforcement (email quotas only), typecheck debt in Stage 6 services, consent withdrawal automation, and full E2E automation coverage.

| Module | Task | Status | Notes |
|--------|------|--------|-------|
| CRM foundation | 6.1 | Ready | Leads, contacts, companies, identity linking, import/export |
| Lead capture forms | 6.2 | Ready | Public submit endpoint, consent blocks, routing, spam quarantine |
| Sales pipeline | 6.3 | Ready | Versioned pipelines, opportunities, forecasting, health metrics |
| CRM tasks & activities | 6.4 | Ready with restrictions | Task lifecycle; follow-up rules partially wired |
| Email infrastructure | 6.5 | Ready | Provider adapters, suppression, webhooks, tenant quotas |
| Email campaigns | 6.6 | Ready with restrictions | Approval workflow; human launch required |
| Marketing automation | 6.7 | Ready with restrictions | Graph safety, consent gates; no autonomous high-risk actions |
| Lead scoring | 6.8 | Ready | Deterministic rules only; AI explains, never modifies scores |
| Lifecycle agent | 6.9 | Ready with restrictions | Evidence-grounded; no autonomous send/price/deal-won |
| Tenant isolation | — | Ready | organisationId + brandId on all queries |
| Test coverage | — | Ready | 300+ Stage 6 unit/integration tests |

## Acceptance criteria status

| Criterion | Status |
|-----------|--------|
| CRM queries scoped by organisation + brand | ✅ `brandService.getById` on all services |
| Sensitive contact data permission-gated | ✅ `crm.viewSensitiveContact` |
| Form submissions tenant-resolved server-side | ✅ `publicFormId` only; no client tenant context |
| Marketing email cannot bypass suppression | ✅ `shouldBlockSend` + `queueMessage` checks |
| Campaign launch requires approval | ✅ `EMAIL_CAMPAIGN_APPROVAL` workflow |
| Automation graphs validated for cycles/depth | ✅ `validateAutomationGraph`, `detectCycles` |
| Lead scoring is deterministic | ✅ No ML scoring; prohibited attributes blocked |
| Lifecycle agent blocks autonomous actions | ✅ `BLOCKED_AUTONOMOUS_ACTIONS` enforced |
| Human approval for material CRM changes | ✅ Action proposals + approval trail |
| Tenant isolation integration tests pass | ✅ CRM, email, automation, scoring, lifecycle routes |
| Prisma schema validates | ✅ `npx prisma validate` |
| Migrations validated | ✅ 59 migrations |
| Typecheck passes | ❌ 49 errors (Prisma Json types, Stage 6 services) |
| Production build passes | ⚠️ Was failing on lifecycle handler exports (fix in progress) |

## Task audit summary

### 6.1 — CRM lead data foundation
Tenant-safe CRM layer alongside `MarketingLead`. Deterministic identity linking, duplicate management, field permissions, CSV import/export with injection protection.

### 6.2 — Lead capture forms
First-party forms with versioned fields, consent blocks, origin allowlist, rate limiting, honeypot/quarantine, hashed IP evidence, CRM lead creation on submit.

### 6.3 — Sales pipeline & opportunities
Configurable versioned pipelines, opportunity stages, forecasting, pipeline health metrics, stage history.

### 6.4 — CRM tasks & activities
Operational task layer with lifecycle transitions, activity logging, follow-up rules (billing integration extension point).

### 6.5 — Email infrastructure
Provider-agnostic send pipeline, domain verification, suppression lists, webhook processing, tenant daily quotas.

### 6.6 — Email campaigns
Campaign builder, template system, A/B testing, approval gates, analytics, launch via 6.5 message pipeline.

### 6.7 — Marketing automation
Journey builder with graph validation, consent/suppression enrollment gates, frequency limits, recursion bounds, action routing through email pipeline.

### 6.8 — Lead scoring
Versioned rule models, FIT/ENGAGEMENT/NEGATIVE categories, caps, decay, qualification mapping, simulation, AI explanations (no score modification).

### 6.9 — AI sales lifecycle agent
Evidence-grounded reviews (daily sales, pipeline, trial risk, renewal), draft-only outreach, action proposals with approval, feedback and outcome tracking.

## Beta scope recommendation

- Cresco Grants Intelligence and Capital Cresco Terminal brands
- MARKETER role or above for campaigns, automation activation, scoring model changes
- ADMIN/OWNER for email domain setup, campaign launch, lifecycle action approval
- Email daily quota enforced per tenant; other plan limits not yet wired
- Human approval required for all outbound marketing, campaign launches, and lifecycle material actions

## Blockers

No unresolved **critical** security or data-integrity issues. Non-blocking engineering debt:

| Item | Severity | Impact |
|------|----------|--------|
| Typecheck failures (49 errors) | Medium | CI gate; mostly Prisma Json and Stage 6 service types |
| Build failure (lifecycle handler exports) | Medium | Deployment blocked until fixed |
| Consent withdrawal not auto-processed | Low | Manual suppression workflow required |
| Billing plan enforcement partial | Medium | Email quotas only; SEO/ad quotas not tied to billing |

## Related documents

- `docs/V1_TENANT_ISOLATION_REVIEW.md`
- `docs/V1_PRIVACY_REVIEW.md`
- `docs/V1_AI_SAFETY_REVIEW.md`
- `docs/V1_KNOWN_LIMITATIONS.md`
- `docs/V1_BETA_SCOPE.md`
- `docs/CRM_ARCHITECTURE.md`
- `docs/MARKETING_AUTOMATION_ENGINE.md`
- `docs/AI_SALES_LIFECYCLE_AGENT.md`
