# Cresco Marketing Intelligence — V1 Release Notes

**Release:** V1.0.0-beta  
**Date:** 2026-08-05  
**Decision:** CONDITIONALLY READY — controlled beta launch

## Overview

Cresco Marketing Intelligence V1 delivers a unified marketing operations platform for Cresco internal brands and approved beta partners. This release spans platform foundation, content operations, analytics, SEO, advertising, CRM, email, automation, provider integrations, publishing, and collaboration — with human-in-the-loop governance on all material customer-facing actions.

## What's included

### Platform foundation
- Multi-tenant workspace with organisation, project, and brand hierarchy
- Role-based access control (VIEWER → OWNER)
- Supabase authentication with email verification and OAuth
- Onboarding wizard for new workspaces
- Audit logging and security settings

### Content operations
- Content Studio with draft, review, and approval workflow
- Asset library with brand governance
- Knowledge base per brand
- Task management with assignments and deadlines
- Content campaigns for coordinated publishing
- Scheduling with compliance checks

### Analytics and intelligence
- Marketing data warehouse and Data Hub
- GA4, Google Search Console, and paid ads connectors
- Executive dashboard with evidence-backed metrics
- Attribution and funnel analysis
- AI Analyst for evidence-grounded recommendations
- Growth intelligence and social experiments

### SEO
- Technical SEO crawler and issue detection
- Keyword intelligence and opportunity scoring
- Competitor analysis and content roadmaps
- On-page SEO recommendations

### Advertising
- Provider-independent campaign planning
- Google, Meta, LinkedIn, and TikTok ad management (governed)
- Budget pacing, alerts, and emergency controls
- Creative studio and A/B experiments
- AI optimisation recommendations (approval required)

### CRM and revenue
- Leads, contacts, companies, and pipelines
- Lead scoring and qualification
- Sales lifecycle AI assistant (draft previews only)
- Lead capture forms with bot protection
- Stripe revenue connector for customer revenue analytics

### Email and automation
- Email campaigns with template-based content
- Deliverability monitoring and suppression
- Marketing automation with journey builder
- Safety gates on high-risk actions (webhooks)

### Integrations and publishing
- Provider integration platform with capability registry
- Mock adapters for development and testing
- Governed outbound publishing operations
- Provider sync engine with retry and dead-letter

### Notifications and collaboration
- Unified notification centre and inbox
- Comment threads with @mentions
- System announcements and digest subscriptions
- In-app and email delivery channels

## Important limitations

This is a **controlled beta**, not unrestricted public launch:

- **No SaaS billing** — tenant provisioning is manual
- **Calendar and AI Agents** routes show "Coming Soon" — not yet productised
- **Some advertising providers** require app review for client accounts
- **All customer messaging, publishing, and ad launches** require human approval
- See `docs/release/KNOWN_LIMITATIONS.md` for full inventory

## Security and compliance

- Tenant isolation tested across all modules
- OAuth credentials encrypted (AES-256-GCM)
- No autonomous send, spend, or publish paths
- Privacy Policy and Terms at `/privacy` and `/terms` (legal review pending)

## Upgrade notes

### Database
- 68 migrations — run `npx prisma migrate deploy` before application deploy
- See `docs/release/DATA_MIGRATION_PLAN.md`

### Environment
- Requires `NODE_OPTIONS=--max-old-space-size=8192` for build/typecheck
- Production Supabase and database URLs must pass `classifyProductionEnvironment()`
- See `docs/DEPLOYMENT.md` for full env var list

### Breaking changes
- None for new deployments
- Existing beta tenants: additive migrations only

## Known issues

| Issue | Severity | Workaround |
|-------|----------|------------|
| Plan quotas not tied to billing | P1 | Manual tenant config |
| E2E not in default CI | P1 | Manual smoke per `SMOKE_TEST_PLAN.md` |
| Meta non-owned account launches | P2 | Use owned accounts in beta |

## Documentation

Full release audit pack: `docs/release/`

- `PRODUCTION_RELEASE_AUDIT.md` — master audit
- `V1_SCOPE.md` — frozen scope
- `RELEASE_SCORE.md` — scored dimensions (72/100)
- `SMOKE_TEST_PLAN.md` — pre/post deploy tests

## Support

- Support procedures: `docs/V1_SUPPORT_RUNBOOK.md`
- Incident reporting: `docs/release/INCIDENT_RESPONSE_PLAN.md`
- Request ID: include from API error response for faster triage

---

*Cresco Marketing Intelligence V1 — built for evidence-backed marketing operations with human oversight.*
