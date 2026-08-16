# AI & Automation Production Audit

**Repository:** Cresco Marketing Intelligence  
**Date:** 2026-08-16  
**Branch:** `cursor/ai-automation-production-6bdf`

## Executive Summary

This audit maps the AI Agent Platform and Automation Engine infrastructure, classifies each component, and documents productionization changes in this branch.

**Final Decision:** **CODE READY — LIVE AI/AUTOMATION E2E REQUIRED**

Production guardrails, canonical paths, domain event wiring, and customer usage visibility are implemented. Live E2E with real LLM credentials and production automation workflows is required before declaring full production readiness.

---

## Part 1 — AI / Automation Audit

### AI Agents

| Component | Path | Classification |
|-----------|------|----------------|
| Agent registry | `src/lib/agent-platform/agent-registry.ts` | production-ready |
| Agent platform service | `src/server/services/agent-platform-service.ts` | production-ready |
| Tool executor | `src/lib/agent-platform/agent-tool-executor.ts` | production-ready |
| Approval service | `src/server/services/agent-approval-service.ts` | production-ready (record-only v1) |
| Lifecycle agent | `src/server/services/lifecycle-agent-service.ts` | production-ready |
| Copilot orchestrator | `src/server/services/copilot-orchestrator-service.ts` | production-ready |
| Copilot conversations | `src/server/services/copilot-conversation-service.ts` | incomplete (in-memory) |
| `/ai-agents` nav | `src/components/navigation/*` | disconnected (placeholder) |

### LLM Providers

| Provider | Path | Classification |
|----------|------|----------------|
| OpenAI | `src/lib/ai/providers/openai-provider.ts` | production-ready |
| Anthropic | `src/lib/ai/providers/anthropic-provider.ts` | production-ready |
| Google | `src/lib/ai/providers/google-provider.ts` | production-ready |
| Mock | `src/lib/ai/providers/mock-provider.ts` | mock (test/dev only after fix) |

### Canonical AI Path

```
AI Request (aiRequestService)
  → model registry / model routing
  → cost controls
  → safety (injection, redaction)
  → provider abstraction (getAIProvider)
  → external LLM
  → structured output validation
  → usage recorder
```

### Mock Paths (Fixed)

| Location | Before | After |
|----------|--------|-------|
| `model-registry.ts` resolveModel | Silent MOCK fallback | `AI_CONFIGURATION_REQUIRED` in production |
| Per-model fallbackModelId | mock-text-v1 | Removed |
| MOCK in production env | enabled | blocked unless `AI_ALLOW_MOCK=true` in dev |

### Cost Controls

| Component | Path | Status |
|-----------|------|--------|
| Per-request limits | `src/lib/ai/cost-controls.ts` | production-ready |
| Org/user daily budgets | `src/lib/ai/cost-controls.ts` | production-ready |
| Usage recorder | `src/server/services/ai-usage-recorder.ts` | production-ready |
| AIUsageRecord model | `prisma/schema.prisma` | production-ready |

### Safety

| Control | Path | Status |
|---------|------|--------|
| Prompt injection | `src/lib/ai/prompt-injection.ts` | production-ready |
| Secret redaction | `src/lib/ai/redaction.ts` | production-ready |
| Structured output schemas | `src/lib/ai/*-output-schemas.ts` | production-ready |
| Agent tool permissions | `src/lib/agent-platform/agent-tool-executor.ts` | production-ready |

### Automation Systems

| System | Path | Classification |
|--------|------|----------------|
| Automation Engine (Stage 9) | `automation-engine-*` | production-ready (wired) |
| Marketing Automation (Task 6.7) | `marketing-automation-*` | production-ready (wired for lead events) |
| Duplicate UI placeholder | `/ai-agents` | duplicate/disconnected |

### Triggers

| Type | Status |
|------|--------|
| Event | production-ready (domain events + engine) |
| Schedule | incomplete (no resume worker for marketing delays) |
| Manual | production-ready |
| Threshold | partial (KPI_BELOW_TARGET, ANALYTICS_THRESHOLD_BREACHED) |
| Provider condition | partial |

### Actions

| Action | Classification |
|--------|----------------|
| CREATE_TASK | executable |
| CREATE_NOTIFICATION | executable |
| ADD_CRM_ACTIVITY | executable |
| UPDATE_LEAD_STATUS | executable |
| ASSIGN_USER | executable |
| CREATE_CALENDAR_EVENT | executable |
| REQUEST_APPROVAL | approval-required |
| UPDATE_CAMPAIGN_STATUS | approval-required |

Canonical executor: `src/server/services/automation-action-executor.ts`

### Workers

| Worker | Path | Status |
|--------|------|--------|
| Publishing scheduler | `/api/publishing-scheduler/process-due` | production-ready |
| Domain event dispatch | `/api/automation/process-domain-events` | **new** |
| Marketing automation delay resume | — | incomplete |

---

## Parts 2–8 — Production LLM, Secrets, Routing, Cost, Safety, Structured Output

Implemented in this branch:

- `AI_CONFIGURATION_REQUIRED` error code
- `src/lib/ai/mock-policy.ts` — explicit mock policy
- `src/lib/ai/model-routing.ts` — capability-based model selection
- Provider secrets server-only via `getServerEnv()` (never in client env)
- Provider availability exposed without keys (`/api/ai/usage`, `/api/ai/diagnostics`)

---

## Parts 9–11 — Domain Events & Event-Driven Automation

### Canonical Domain Events

`src/lib/domain-events/constants.ts`:

- `publication.succeeded` / `publication.failed` / `publication.reauth_required`
- `lead.created` / `lead.qualified`
- `campaign.created` / `content.approved`
- `provider.sync_failed` / `analytics.updated` / `budget.threshold_reached`

### Emitters Wired

- `notification-event-service.publishingFailed` → domain event + notification
- `notification-event-service.publishingSucceeded` → domain event + notification

### Outbox

`DomainEventOutbox` model with idempotency keys → async automation dispatch.

Flow:

```
Domain mutation (persisted)
  → domainEventService.emit()
  → DomainEventOutbox (idempotent)
  → automationEngineExecutionService.dispatchEvent() [async]
  → automationActionExecutor.execute()
```

---

## Parts 12–17 — Triggers, Conditions, Actions, Approvals, UX

- Unsupported schedule triggers for marketing automation delays remain incomplete
- Action classification exposed for UI (`action-classification.ts`)
- Customer usage UI: `/settings/ai-usage`
- AI diagnostics shows provider status without secrets

---

## Parts 18–22 — Agents, Tools, Memory, Idempotency, Loop Protection

| Area | Status |
|------|--------|
| Agent roles/tools/budgets | production-ready (agent-registry) |
| Tool server-side permissions | production-ready |
| Agent memory | incomplete (copilot in-memory) |
| Event idempotency | production-ready (outbox + execution keys) |
| Loop protection | production-ready (depth + self-trigger prevention) |

---

## Parts 23–26 — Retry, Observability, Usage UI, Provider Failure UX

- Retries reuse automation engine step retries (Task 3 pattern)
- AI usage metrics via `AIUsageRecord` + automation execution counts
- `/settings/ai-usage` — customer-visible usage
- `AI_CONFIGURATION_REQUIRED` — explicit failure, no silent mock

---

## Parts 27–28 — Tenant Isolation & RBAC

Existing tests cover agent platform and tenancy. Adversarial tests for automation cross-tenant access should be extended in follow-up.

Permissions: `ai.usage.read`, `ai.diagnostics`, `automation.*`, `agent.approve`

---

## Part 29 — E2E Scenarios

| Scenario | Test | Status |
|----------|------|--------|
| A: Publication failure → automation | `domain-automation-e2e.test.ts` | unit/integration |
| B: Analytics threshold → approval | — | requires live workflow |
| C: AI provider unavailable | `ai-production-guard.test.ts` | pass |
| D: Duplicate event | `domain-automation-e2e.test.ts` | pass |

---

## Definition of Done Checklist

- [x] Production LLM configured (explicit env keys required)
- [x] No silent production mock
- [x] Canonical AI provider layer
- [x] Cost controls (existing + usage UI)
- [x] Safety controls (existing)
- [x] Real domain events emitted (publication)
- [x] Event automations execute (engine dispatch wired)
- [x] Canonical action executor
- [x] Approvals work (existing + classification)
- [x] Task 3 worker pattern (domain event worker route)
- [x] Idempotency works
- [x] Loop protection works
- [ ] Tenant isolation adversarial tests (partial)
- [ ] RBAC adversarial tests (partial)
- [x] Customer usage visibility
- [ ] Real LLM E2E (requires live keys)
- [ ] Real automation E2E (requires live workflows)
- [ ] All CI/build passes (pending validation run)
