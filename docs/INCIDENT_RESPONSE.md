# Incident Response

## Severity levels

| Level | Description | Response time |
|-------|-------------|---------------|
| S1 — Critical | Production down, data breach, credential leak | Immediate |
| S2 — High | Major feature broken, tenant isolation concern | < 4 hours |
| S3 — Medium | Degraded performance, non-critical bug | < 1 business day |
| S4 — Low | Minor issue, workaround available | Next sprint |

## Initial response

1. **Acknowledge** — Confirm the incident and assign an incident lead.
2. **Contain** — Disable affected feature flags, rotate compromised credentials, block abusive IPs if needed.
3. **Assess** — Determine scope: which tenants, data types, and systems are affected.
4. **Communicate** — Notify stakeholders per severity level.
5. **Resolve** — Deploy fix or rollback per `docs/ROLLBACK.md`.
6. **Review** — Post-incident review within 5 business days.

## Security incidents

If credential exposure is suspected:

1. Rotate `ENCRYPTION_KEY` only with a planned re-encryption strategy (connector credentials).
2. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard.
3. Rotate OAuth client secrets for affected providers.
4. Revoke active connector tokens via disconnect flow.
5. Review audit logs and security audit log for anomalous access.

## Data breach

1. Contain access immediately.
2. Preserve logs (do not delete audit records).
3. Assess affected tenant records.
4. Notify legal/compliance per organisational policy.
5. Document timeline and remediation.

## Escalation contacts

Configure for your organisation:

| Role | Contact |
|------|---------|
| Engineering lead | |
| Security lead | |
| Infrastructure | |
| Product owner | |

## Logging and evidence

- Request IDs (`x-request-id`) correlate API errors
- `AuditLog` and `SecurityAuditLog` provide tenant activity trail
- Do not paste secrets into incident tickets
