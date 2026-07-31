# V1 AI Safety Review

Audit of all AI features across Stages 1–6 before V1 release.

## Summary

| Principle | Status | Implementation |
|-----------|--------|----------------|
| No autonomous customer-facing actions | ✅ Enforced | Human approval gates on send, launch, publish, CRM mutations |
| Evidence-grounded outputs | ✅ Enforced | Evidence packages on analyst, SEO, advertising, lifecycle agents |
| Prompt injection detection | ✅ Active | `detectPromptInjection`, `sanitiseAnalysisNotes` |
| PII blocked from AI pipelines | ✅ Active | Redaction, lifecycle PII detection, analyst minimisation |
| Structured output validation | ✅ Active | Schema validation with deterministic fallback |
| Cost and rate limits | ✅ Active | `AIRequestService`, tenant rate limiter |
| No arbitrary database access | ✅ Enforced | Whitelist metrics/dimensions in analyst |
| LLM cannot directly mutate providers | ✅ Enforced | `assertNoDirectLlmMutation()` in advertising |

**No critical AI safety vulnerabilities identified.**

## AI feature inventory

### Stage 1 — Secure AI Core

| Feature | Autonomous action | Safety controls |
|---------|-------------------|-----------------|
| AI request service | No | Redaction, cost tracking, rate limits, digest storage |
| Brand knowledge AI | No | Tenant-scoped, structured output |
| Diagnostics | No | Admin-only; disabled in production by default |

### Stage 2 — Social Media AI

| Feature | Autonomous action | Safety controls |
|---------|-------------------|-----------------|
| Content generation | No | Draft only; publish requires approval |
| Visual studio | No | Asset validation; no auto-post |
| Caption/hashtag suggestions | No | User selects before publish |

### Stage 3 — AI Marketing Analyst

| Feature | Autonomous action | Safety controls |
|---------|-------------------|-----------------|
| Natural language queries | No | Approved metrics only; no arbitrary SQL |
| Weekly executive brief | No | Evidence package; numeric whitelist validation |
| Anomaly detection | No | Findings only; action proposals require approval |
| Action proposals | No | Human approval required for creation |

Reference: `docs/STAGE_3_SECURITY_REVIEW.md`

### Stage 4 — SEO AI

| Feature | Autonomous action | Safety controls |
|---------|-------------------|-----------------|
| SEO brief generator | No | Evidence-grounded; approval workflow |
| Long-form content studio | No | Claim review; no auto-publish |
| On-page AI review | No | Deterministic checks primary; AI advisory |
| Topic clustering | No | Deterministic + AI hybrid; no auto-modify |
| Internal link recommendations | No | Proposals only; no auto-modify |

### Stage 5 — Advertising AI

| Feature | Autonomous action | Safety controls |
|---------|-------------------|-----------------|
| Creative generation | No | Compliance scan; no auto-publish |
| Campaign planning | No | Versioned plans; 8 approval gates for launch |
| Audience intelligence | No | Planning only; no external activation |
| Optimisation agent | No | `canAutoApply: false`; evidence per run |
| Budget AI recommendations | No | Change request + approval workflow |

Blocked actions: `AUTO_SEND_MESSAGE`, autonomous launch, autonomous budget increase.

Reference: `docs/AD_OPTIMISATION_GUARDRAILS.md`, `docs/STAGE_5_SECURITY_REVIEW.md`

### Stage 6 — CRM AI

| Feature | Autonomous action | Safety controls |
|---------|-------------------|-----------------|
| Lead scoring AI assistant | No | `modifiesScore: false`, `autoApplyBlocked: true` |
| Lifecycle agent | No | Draft-only outreach; approval for material actions |
| Follow-up assistant | No | Suggestions only; task creation requires user action |
| Email campaign AI (if used) | No | Template suggestions; launch requires approval |

#### Lifecycle agent prohibited actions

```
AUTO_SEND_MESSAGE      — never sent without manual action
AUTO_PRICE_CHANGE      — never applied autonomously
AUTO_DISCOUNT          — requires explicit human approval
AUTO_DEAL_WON          — requires evidence + authorised confirmation
AUTO_LIFECYCLE_CHANGE  — requires approval
AUTO_STAGE_CHANGE      — blocked from LLM output
```

Reference: `docs/LIFECYCLE_AGENT_SAFETY.md`, `docs/LEAD_SCORING_SAFETY.md`

## Cross-cutting controls

### AIRequestService (all stages)

- Server-only API keys
- `SensitiveDataRedactor` before provider calls
- SHA-256 digests of redacted input/output (not full prompts)
- Token usage and cost metadata
- Tenant-scoped rate limiting
- `ALLOW_AI_DIAGNOSTICS=false` in production

### Prompt injection

| Module | Detection |
|--------|-----------|
| Lifecycle agent | `sanitiseAnalysisNotes()` — blocks run on detection |
| Advertising optimisation | `detectPromptInjection` on user notes |
| SEO briefs | Input sanitisation |
| Analyst | Query planner whitelist (no free-form SQL) |

### Deterministic fallback

When AI output fails validation:

- Analyst → deterministic summary from evidence package
- Lead scoring → rules-only scoring (AI explanation optional)
- Lifecycle agent → run blocked or findings suppressed on LOW confidence

### Commercial safety constants

Verified in `tests/unit/v1-production-readiness.test.ts`:

- `LIFECYCLE_NO_AUTONOMOUS_DISCLAIMER` — must not autonomously send/price
- `ADVERTISING_NO_AUTONOMOUS_DISCLAIMER` — must not autonomously launch/increase budgets
- `blockAutonomousSend(false)` → blocked
- `blockAutonomousPriceChange(false)` → blocked

## Automation AI safety (Stage 6.7)

| Control | Implementation |
|---------|----------------|
| Cycle detection | `detectCycles()` — cyclic graphs rejected |
| Depth/path bounds | MAX_GRAPH_NODES=100, MAX_DEPTH=50, MAX_PATHS=20 |
| Recursion limit | Max depth 3 for cross-automation enrollment |
| High-risk actions | WEBHOOK requires approval flag |
| Consent gates | Pre-messaging exit rules on consent withdrawal |

## Lead scoring safety (Stage 6.8)

| Control | Implementation |
|---------|----------------|
| Deterministic only | No ML/black-box scoring |
| Prohibited attributes | race, gender, age, religion, credit score, etc. |
| Score caps | Per-rule, per-group, per-category, composite |
| Model review checklist | `validateModelSafety()` before activation |

## Findings

| Severity | Finding | Mitigation |
|----------|---------|------------|
| Low | Regex-based prompt injection detection | Documented; human review on material actions |
| Low | No advertising-specific AI rate limit beyond platform | Platform AI cost limits apply |
| Low | Lead scoring AI could suggest biased rules | Human model review required; prohibited attributes blocked |
| Info | Some SEO AI paths use advisory-only mode | Deterministic checks are primary |

## Production configuration

```bash
ALLOW_AI_DIAGNOSTICS=false    # Required in production
ALLOW_TEST_AUTH=false         # Required in production
```

## Sign-off

| Check | Status |
|-------|--------|
| No autonomous send/launch/publish paths | ✅ |
| Evidence packages on all material AI agents | ✅ |
| Prompt injection detection active | ✅ |
| PII redaction before provider calls | ✅ |
| Disclaimer constants verified in tests | ✅ |
