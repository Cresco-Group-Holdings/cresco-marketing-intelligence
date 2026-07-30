# Stage 3 Security Review

## Summary

Stage 3 security controls align with Stage 1 baseline. No critical vulnerabilities identified in Tasks 3.1–3.10.

## Controls verified

| Control | Implementation |
|---------|----------------|
| Tenant isolation | All dashboard/analyst queries scoped by `organisationId` + `brandId` |
| RBAC | `marketingData.*`, `ai.analyst.*`, `connectors.*` permissions |
| Stripe secrets | Server-only via `getStripeConfig()` |
| Webhook verification | HMAC signature on `/api/webhooks/stripe` |
| OAuth state | Encrypted credentials, state tokens, CSRF |
| AI governance | Whitelist validation, no arbitrary SQL, redaction, cost controls |
| Lead PII | Not exposed in analyst prompts; minimised exports |
| Cross-tenant cache | Tenant-scoped cache keys in executive dashboard |
| No autonomous spend | Analyst proposes actions only; no budget/publish automation |

## AI analyst safety

- Query planner uses approved metrics/dimensions only
- No arbitrary database access from AI
- Output validation rejects invented statistics
- Deterministic fallback when AI fails validation
- Human approval required for action creation

## Webhook security

- Signature verification required
- Idempotency via `revenueSyncRun`
- Log sanitisation (no card data)

## Recommendations

1. Enable `ALLOW_AI_DIAGNOSTICS=false` in production
2. Rotate Stripe webhook secrets per environment
3. Restrict analyst generate permission to MARKETER+ roles
4. Monitor failed webhook signature attempts
