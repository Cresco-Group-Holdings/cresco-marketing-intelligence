# Stage 5 Security Review

Security audit of the AI Advertising Platform (Tasks 5.1–5.9).

## Summary

| Area | Status | Notes |
|------|--------|-------|
| OAuth token storage | Pass | Platform credential encryption; tokens not logged |
| Token refresh | Pass | Connector refresh flows; expired token handling in error recovery |
| Provider account IDOR | Pass | All queries scoped by organisationId + brandId |
| Cross-tenant mutations | Pass | `brandService.getById` enforces tenant on every service call |
| Webhook signatures | N/A | No advertising webhooks in Stage 5 |
| Replay attacks | Pass | Idempotency keys on launches; plan hash binding |
| Mutation-plan tampering | Pass | SHA-256 hash; stale approval invalidation |
| Forged approvals | Pass | Approvals stored server-side; plan hash verified at launch |
| Budget bypass | Pass | Guardrails block AI-suggested mutations; hard limits auto-reject |
| Provider callback validation | N/A | OAuth callbacks use platform OAuth handler |
| Sensitive audience export | Pass | No external audience upload; PII blocked in optimisation input |
| Personal-data leakage | Pass | PII patterns blocked in optimisation guardrails |
| Raw provider response exposure | Pass | Raw data behind `marketingData.viewRaw` permission |
| CSV injection | Pass | Warehouse CSV safety module available |
| Asset-file attacks | Pass | Asset upload via platform asset library with validation |
| Stored XSS | Pass | React rendering; no `dangerouslySetInnerHTML` in advertising UI |
| Malicious provider errors | Pass | Error normalisation in adapter contract; no error content executed |

## OAuth security

- Google: `adwords` scope; developer token in server env only
- Meta: `ads_read` / `ads_management`; app secret server-side
- LinkedIn: `r_ads`, `rw_ads` scopes
- TikTok: advertiser access token; refresh via connector

Tokens are never returned in API responses or logged.

## Mutation safety

- Plan hash computed from canonical JSON of operations
- 8 approval types required before launch (CAMPAIGN, CREATIVE, COMPLIANCE, BUDGET, CONVERSION, ACCOUNT_PERMISSION, PROVIDER_VALIDATION, FINAL_LAUNCH)
- Approvals invalidated when plan hash changes
- Idempotency keys prevent duplicate launches
- `assertNoDirectLlmMutation()` blocks LLM-sourced provider/budget changes

## AI safety

- Prompt injection detection on user notes (`detectPromptInjection`)
- Structured output schemas with evidence, uncertainty, disclaimers
- Optimisation agent blocks actions from LLM output
- Budget AI recommendations: `canAutoApply: false` always

## Findings

| Severity | Finding | Mitigation |
|----------|---------|------------|
| Low | Google idempotency key lacks provider prefix | Documented; shared `buildIdempotencyKey` added in 5.10 |
| Low | Sensitive targeting detection is regex-based | Documented limitation; human review required |
| Low | No advertising-specific rate limiting | Platform AI cost limits apply |
| Info | Audit events not wired to all launch paths | `recordAdvertisingAuditEvent` added; budget emergency wired |

## No critical or high findings
