# V1 Beta Scope

Defines allowed tenants, roles, features, and operational boundaries for V1 controlled beta.

## Release decision context

V1 ships as **READY WITH RESTRICTIONS**. This document defines who may use the platform and under what constraints.

## In-scope tenants

| Tenant | Purpose | Notes |
|--------|---------|-------|
| Cresco internal | Dogfooding all stages | Full feature access with restrictions |
| Grants Intelligence | Product brand | Primary V1 customer-facing use case |
| Capital Cresco Terminal | Product brand | Primary V1 customer-facing use case |
| Limited external pilots | Signed beta agreement | Case-by-case approval; restricted features |

## Out of scope for V1 beta

- General public self-service signup without approval
- Client advertising accounts without provider app review (Meta)
- High-volume email sending without domain warm-up
- Multi-organisation portfolio management
- White-label / reseller deployments
- HIPAA-regulated health data processing
- Payment card data storage (Stripe handles PCI)

## In-scope features

### Stage 1 — Foundation
- Workspace, RBAC, onboarding
- Brand knowledge base and asset library
- Connector framework and OAuth
- Secure AI core

### Stage 2 — Social
- Content creation and scheduling
- Social publishing (with approval)
- Social analytics and leads inbox
- Growth intelligence

### Stage 3 — Analytics
- Marketing data warehouse
- First-party tracking
- GA4, GSC, paid ads connectors
- Attribution, funnels, revenue (Stripe)
- Executive dashboard and AI analyst

### Stage 4 — SEO
- Technical crawler (verified domains)
- Keyword intelligence, competitor analysis
- Topic clusters, SEO briefs, long-form content
- On-page audits, internal linking
- Rank tracking, content refresh

### Stage 5 — Advertising
- Campaign planning, creative studio, audience intelligence
- Google/Meta/LinkedIn/TikTok draft and controlled launch
- Experiments, budget governance, AI optimisation reviews
- **Human approval required for all launches**

### Stage 6 — CRM & Revenue Ops
- CRM (leads, contacts, companies, identity linking)
- Lead capture forms with consent
- Sales pipelines and opportunities
- CRM tasks and activities
- Email infrastructure and campaigns
- Marketing automation journeys
- Lead scoring (deterministic)
- AI lifecycle agent (recommendations only)

## Role requirements

| Action | Minimum role |
|--------|-------------|
| View dashboards, CRM, analytics | VIEWER |
| Create content, drafts, run analysis | MARKETER |
| Launch campaigns, approve emails, connect providers | ADMIN |
| Emergency controls, org policy, billing | OWNER |
| Lifecycle action approval | ADMIN (with `lifecycleAgent.approve`) |
| Email domain setup | ADMIN |
| Lead scoring model activation | ADMIN |
| Advertising launch | ADMIN (8 approval gates) |

## Provider account restrictions

| Provider | Beta account type |
|----------|-------------------|
| Google Ads | Test account or low-spend production |
| Meta Ads | Owned sandbox or test ad account |
| LinkedIn Ads | Test ad account |
| TikTok Ads | Production advertiser (low spend) |
| Email (SES/SendGrid/etc.) | Dedicated sending domain per tenant |
| Stripe | Test mode for pilots; live with `brand_id` metadata |
| Social platforms | Test/developer accounts |

## Spending and volume limits

| Domain | Limit |
|--------|-------|
| Advertising daily spend | Organisation hard limit policy (default 50% increase cap) |
| Advertising daily change | 20% without escalation |
| Email daily send | Tenant quota (organisation-configured) |
| SEO concurrent crawls | 3 per organisation |
| SEO competitor crawls | Per-org daily limit |
| AI requests | Platform cost limits + tenant rate limiter |
| Form submissions | 20/min, 100/hour per IP per form |

## Human-in-the-loop requirements

All beta tenants must operate with:

1. Human approval before any marketing email campaign launch
2. Human approval before any advertising campaign launch
3. Human review of lifecycle agent recommendations before material CRM actions
4. Human review of AI analyst action proposals
5. No autonomous social publishing without explicit schedule approval
6. Lead scoring model review before activation

## Beta agreement terms (external pilots)

External pilot organisations must acknowledge:

- Platform is beta software with known limitations (`V1_KNOWN_LIMITATIONS.md`)
- Data accuracy disclaimers apply (Unavailable metrics, provider delays)
- DSR requests handled manually during beta
- No SLA below best-effort during beta period
- Feature availability may change with notice
- Emergency maintenance may occur without advance notice

## Escalation to unrestricted production

Beta restrictions lift when:

1. All V1 release checklist items complete (including typecheck and build)
2. Billing plan enforcement expanded
3. DSR workflow implemented or legally accepted manual process
4. Provider app reviews complete for required accounts
5. Post-launch monitoring shows stable error rates for 30 days

## Related documents

- `docs/V1_PRODUCTION_READINESS.md`
- `docs/V1_KNOWN_LIMITATIONS.md`
- `docs/STAGE_5_BETA_SCOPE.md`
- `docs/STAGE_4_PRODUCTION_READINESS.md` (SEO beta scope)
