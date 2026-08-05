# V1 Scope Freeze

**Effective:** 2026-08-05  
**Status:** FROZEN — no uncontrolled feature expansion permitted for V1 launch.

## Scope freeze rules

1. Only **P0/BLK defect fixes** and **documentation** may ship after freeze without release-board approval.
2. New modules, routes, or provider capabilities require a **V1.1** milestone.
3. Routes marked **Coming Soon** must not be promoted to Production Ready without full implementation and tests.
4. Beta modules must display honest capability boundaries in UI and docs.

## Module classification

| Module | Classification | Route(s) | Notes |
|--------|----------------|----------|-------|
| Authentication | **Production Ready** | `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` | Supabase Auth, rate limits, session rotation |
| Onboarding | **Production Ready** | `/onboarding` | Wizard + API; E2E spec exists |
| Workspace context | **Production Ready** | Org/project/brand selectors, middleware | Tenant context on all APIs |
| Dashboard (Overview) | **Production Ready** | `/dashboard` | Workspace summary |
| Campaigns (content) | **Production Ready** | `/campaigns` | Content campaign coordination |
| Knowledge Base | **Production Ready** | `/knowledge`, `/brands/[id]/knowledge` | Brand-scoped knowledge |
| Assets | **Production Ready** | `/assets`, `/brands/[id]/assets` | Asset library with governance |
| Content Studio | **Production Ready** | `/content` | Draft, review, approval workflow |
| Tasks | **Production Ready** | `/tasks` | Assignments, deadlines |
| Calendar | **Coming Soon** | `/calendar` | Nav marked `comingSoon`; empty state only |
| Analytics | **Beta** | `/analytics/*` | GA4, GSC, social, attribution; data freshness caveats |
| CRM | **Beta** | `/crm/*` | Leads, contacts, pipelines, opportunities |
| Automation | **Beta** | `/automation` | Journey builder; high-risk actions gated |
| AI Agents (hub) | **Coming Soon** | `/ai-agents` | Nav marked `comingSoon`; empty state only |
| AI Analyst | **Beta** | `/analyst` | Evidence-grounded; no autonomous execution |
| AI Sales Assistant | **Beta** | `/crm/assistant` | Draft previews only; human approval required |
| Integrations (provider platform) | **Beta** | `/integrations` | Mock + Resend live; some providers DISABLED |
| Connectors (legacy) | **Beta** | `/connectors/*` | GA4, GSC, paid-ads connectors |
| Publishing | **Beta** | `/publishing` | Governed outbound ops; mock-social validated |
| Notifications / Inbox | **Production Ready** | `/notifications`, `/inbox` | Unified inbox + social inbox |
| Social Media | **Beta** | `/social` | Connections, publishing hooks |
| Advertising (all platforms) | **Limited Availability** | `/advertising/*` | Human approval gates; Meta app review for client accounts |
| Email campaigns | **Beta** | `/email/*` | Template-based; approval required |
| SEO | **Beta** | `/seo/*` | No JS rendering; crawl quotas |
| Data Hub / Warehouse | **Beta** | `/data/*` | Warehouse ingestion and quality |
| Growth / Experiments | **Beta** | `/growth`, `/experiments` | Recommendations and social experiments |
| Leads | **Beta** | `/leads` | Social-to-lead qualification |
| Forms | **Beta** | `/forms` | Lead capture with bot protection |
| Operations | **Internal Only** | `/operations` | Failure recovery; ops alerts |
| Visual Studio | **Beta** | `/visual-studio` | AI image/carousel generation |
| Billing (SaaS) | **Disabled** | — | No subscription management UI; not in V1 |
| Revenue analytics (Stripe) | **Limited Availability** | `/analytics/revenue` | Connector for customer revenue data, not platform billing |
| Settings / Admin | **Production Ready** | `/settings/*` | Org, members, audit, projects |
| AI Diagnostics | **Internal Only** | `/settings/ai-diagnostics` | Admin/dev only |

## V1 in-scope capabilities

- Multi-tenant workspace with RBAC
- Content lifecycle: draft → review → approve → schedule → publish (with approval)
- CRM foundation: leads, contacts, pipelines, tasks, scoring, qualification
- Marketing automation with safety gates
- Email campaigns with suppression and approval
- Analytics connectors (GA4, GSC, paid ads, social)
- Advertising planning and governed launch (no autonomous spend)
- SEO technical audit and keyword intelligence
- Provider integration platform (Stage 7) with mock adapters
- Publishing operations (Stage 14) with governance
- Notifications and collaboration inbox (Stage 15)
- AI assistance with human-in-the-loop on all material actions

## Explicitly out of V1 scope

- Public self-serve signup without beta agreement
- SaaS subscription billing and plan checkout
- White-label / multi-region deployment
- Content Calendar product UI (route exists as placeholder)
- AI Agents configuration hub (route exists as placeholder)
- Autonomous send, publish, or spend
- PCI card storage (delegated to Stripe for revenue connector only)
- Full WCAG 2.2 AA certification
- Visual drag-and-drop email builder

## Allowed tenants (V1 beta)

See `docs/V1_BETA_SCOPE.md`:

- Cresco internal brands
- Grants Intelligence
- Capital Cresco Terminal
- Limited external pilots with signed beta agreement

## Change control

| Change type | Approval |
|-------------|----------|
| BLK/P0 fix | Engineering lead + on-call |
| P1 fix | Engineering lead |
| Scope expansion | Product + Engineering sign-off → V1.1 |
| New provider (live) | Security review + ops runbook |
