# Stage 17: Incident Response Procedures

## Severity levels

| Level | Description | Response target |
|-------|-------------|-----------------|
| SEV1 | Full platform outage or active data breach | Immediate — all hands |
| SEV2 | Major feature degradation affecting many tenants | 30 minutes |
| SEV3 | Partial degradation or single-tenant impact | 4 hours |
| SEV4 | Minor issue with workaround available | Next business day |

## Initial response checklist

1. Acknowledge the incident and assign an incident commander.
2. Record the incident in Admin Centre (`/admin`) or `IncidentLog` table.
3. Check `/api/readiness` and Admin Centre system health.
4. Review security events at `/admin/security`.
5. Check failed jobs at `/admin/failed-jobs`.
6. Communicate via system announcements if user-facing impact exists.

## Common scenarios

### Authentication outage
- Verify Supabase Auth status and `SUPABASE_*` environment variables.
- Check `/api/health` liveness.
- Review `SecurityAuditLog` for spike in `AUTH_*` failures.

### Database connectivity failure
- Readiness check `database` will report `fail`.
- Verify `DATABASE_URL` / `DIRECT_URL` and connection pool limits.
- Follow `docs/V1_BACKUP_RECOVERY.md` if restore is required.

### Billing / Stripe outage
- Platform billing webhooks queue in `BillingEvent` with `FAILED` status.
- Billing continues in degraded mode — entitlements use last known subscription state.
- Do not trust client-reported payment state; reconcile via Stripe dashboard after recovery.

### Provider credential compromise
1. Revoke affected connections via integrations UI or `providerConnectionService`.
2. Rotate `PROVIDER_ENCRYPTION_KEY` per runbook if vault may be exposed.
3. Audit `ProviderAuditEvent` for unauthorised access.
4. Notify affected tenants.

### AI provider outage
- Agent runs fail gracefully with `RATE_LIMITED` or provider errors.
- Cost controls prevent runaway spend.
- HIGH_IMPACT tools require human approval — no auto-execution.

## Escalation

1. On-call engineer → Engineering lead → Security officer → Executive sponsor.
2. For SEV1/SEV2, create a system announcement (`/admin/announcements`) with severity `critical`.

## Post-incident

1. Resolve incident status in `IncidentLog`.
2. Document root cause, timeline, and remediation.
3. Add regression tests where applicable.
4. Schedule backup restore verification if data integrity was in question.
