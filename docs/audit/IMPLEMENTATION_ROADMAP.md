# Implementation Roadmap

**Derived from audit findings** | **Main SHA:** `8910740` | **Date:** 2026-08-16

This roadmap replaces legacy stage numbering with dependency-ordered execution based on code reality.

---

## Stage 1 — Foundation Repair (4–6 weeks)

**Goal:** Single truthful architecture for connect, publish, and revoke.

| Work item | Backlog IDs |
|-----------|-------------|
| Real social OAuth adapters (6 platforms) | P0-001 |
| Real OAuth token exchange/refresh/revoke | P0-002 |
| Unify publishing paths; deprecate mock gateway in product UI | P0-003 |
| Consolidate integration APIs (Stage 12 canonical) | P1-015 |
| Unify revoke semantics + credential cleanup | P1-009 |
| Fix misleading nav/landing pages | P1-001, P1-002, P1-003 |

**Exit criteria:**
- Customer can connect Instagram (or pilot platform) with real token
- Customer can schedule + publish via single UI path
- No mock tokens in production connect flow

---

## Stage 2 — Worker & Scheduler Infrastructure (2–3 weeks)

**Goal:** Background jobs run reliably in production.

| Work item | Backlog IDs |
|-----------|-------------|
| Publishing worker cron (5-min target) | P0-005 |
| SEO crawl, DAM, notification digest workers | P1-012, P1-013, P1-014 |
| Automation schedule runner | P1-007 |
| Document worker secrets in deployment guide | — |

**Exit criteria:**
- Scheduled content publishes without manual API calls
- SEO crawls run on schedule
- DAM processing completes

---

## Stage 3 — End-to-End Organic Social (3–4 weeks)

**Goal:** Complete Workflow A for 2–3 priority platforms.

| Work item | Backlog IDs |
|-----------|-------------|
| Schedule UI in Content Studio | P0-004 |
| Publication result UI feedback | — |
| Social analytics sync → dashboard | P1-004, P1-005 (partial) |
| Sandbox E2E tests | P0-008 |
| Inbox real adapters (priority platform) | P1-011 (partial) |

**Exit criteria:**
- Create → approve → schedule → publish → see result → see basic metrics
- CI sandbox E2E green for pilot platform

---

## Stage 4 — Provider Productionization (4–6 weeks)

**Goal:** Integrations catalogue usable by customers.

| Work item | Backlog IDs |
|-----------|-------------|
| Enable priority providers in definitions | P0-006 |
| Real marketing data sync adapters | P1-004 |
| Analytics dashboards from live data | P1-005 |
| Provider health monitoring in UI | — |

**Exit criteria:**
- 5+ providers connectable with real tokens
- Analytics dashboard shows synced data

---

## Stage 5 — Paid Media Completion (3–4 weeks)

**Goal:** Workflow B for Google + Meta minimum.

| Work item | Backlog IDs |
|-----------|-------------|
| Connector OAuth aligned with Stage 12 | P0-002 |
| Simplified launch happy path | P2-007 |
| Performance sync → advertising dashboards | P1-005 |

**Exit criteria:**
- Create campaign → launch ad → see performance metrics

---

## Stage 6 — AI & Automation Production (3–4 weeks)

**Goal:** AI and automation deliver measurable value.

| Work item | Backlog IDs |
|-----------|-------------|
| Production LLM enforcement | P0-007 |
| Agent action execution post-approval | P1-008 |
| Domain event emitters for automation | P1-006 |
| Automation Engine UI (non-demo) | — |

**Exit criteria:**
- AI generation uses real models in production
- Automation triggers on campaign activation

---

## Stage 7 — Monetization & Enterprise Hardening (4–6 weeks)

**Goal:** Charge customers; enterprise baseline.

| Work item | Backlog IDs |
|-----------|-------------|
| Stripe billing complete | P1-017 |
| Error tracking / APM | P1-018 |
| RBAC gap fixes | P1-010 |
| Security review + pen test prep | SEC findings |

**Exit criteria:**
- Customer can subscribe and pay
- Production errors visible in monitoring

---

## Stage 8 — Scale & Polish (ongoing)

| Work item | Backlog IDs |
|-----------|-------------|
| Schema modularization | P2-003 |
| External calendar sync | P2-001 |
| Full E2E CI | P2-005 |
| Enterprise SSO | P3-008 |
| Nav UX simplification | P3-005 |

---

## Dependency graph

```
Stage 1 (OAuth + Publish unification)
    ↓
Stage 2 (Workers)
    ↓
Stage 3 (Organic E2E) ──→ Stage 4 (Providers)
    ↓                           ↓
Stage 5 (Paid Media) ←──────────┘
    ↓
Stage 6 (AI + Automation)
    ↓
Stage 7 (Billing + Hardening)
    ↓
Stage 8 (Scale)
```

---

## What NOT to do first

- Do not add new Prisma models before unifying publishing/connection paths
- Do not enable more providers before real token exchange works
- Do not invest in Automation Engine UI before event emitters exist
- Do not market AI Agents before production LLM config is enforced

---

## Estimated timeline to V1 launch

**Minimum viable launch (organic social + CRM + content):** Stages 1–3  
**Full marketing intelligence V1:** Stages 1–6  
**Revenue-ready:** Stage 7

*Timeline depends on team size; audit provides dependency order only.*
