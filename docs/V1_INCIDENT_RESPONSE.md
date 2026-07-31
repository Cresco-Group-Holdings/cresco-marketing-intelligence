# V1 Incident Response

Incident severity, response procedures, and escalation for V1 production.

## Severity levels

| Level | Description | Examples | Response time |
|-------|-------------|----------|---------------|
| S1 — Critical | Production down, data breach, credential leak, cross-tenant data exposure | Database unreachable, ENCRYPTION_KEY leaked, tenant A sees tenant B data | Immediate |
| S2 — High | Major feature broken, email deliverability collapse, advertising spend anomaly | Campaign sends failing, suppression bypass suspected, emergency spend alert | < 4 hours |
| S3 — Medium | Degraded performance, non-critical bug, single-tenant feature issue | Slow dashboard, scoring miscalculation, form quarantine spike | < 1 business day |
| S4 — Low | Minor issue, workaround available | UI cosmetic bug, stale analytics data | Next sprint |

## Initial response

1. **Acknowledge** — Confirm incident; assign incident lead.
2. **Contain** — Apply emergency flags, rotate credentials, pause affected features.
3. **Assess** — Scope: which tenants, data types, systems affected.
4. **Communicate** — Notify stakeholders per severity (see Communication below).
5. **Resolve** — Deploy fix or rollback per `V1_ROLLBACK_PLAN.md`.
6. **Review** — Post-incident review within 5 business days (S1/S2 within 48h).

## Module-specific containment

### Cross-tenant data exposure (S1)

1. Immediately revoke affected API routes if isolate-able.
2. Preserve audit logs — do not delete evidence.
3. Identify affected tenant IDs and record types.
4. Notify legal/compliance per organisational policy.
5. Assess backup for forensic analysis.

### Email deliverability crisis (S2)

1. Pause all active email campaigns.
2. Check bounce/complaint rates in email analytics.
3. Verify suppression list integrity.
4. Review recent domain/DKIM changes.
5. Contact email provider support if provider-side block.

### Advertising spend anomaly (S2)

1. Set `ADVERTISING_EMERGENCY_SHUTDOWN=true`.
2. Trigger organisation budget freeze via UI.
3. Manually pause campaigns in provider UI.
4. Review `AdvertisingSpendIncident` records.
5. Follow `docs/AD_BUDGET_INCIDENT_RUNBOOK.md`.

### CRM data integrity (S2)

1. Pause affected automations and campaigns.
2. Identify scope of corrupted records.
3. Restore from PITR if widespread (see `V1_BACKUP_RECOVERY.md`).
4. Notify affected tenants.

### AI safety incident (S2)

1. Revoke `lifecycleAgent.run`, `ai.analyst.generate` permissions.
2. Review `AIRequest` digests for affected runs.
3. Check for prompt injection bypass.
4. Disable `ALLOW_AI_DIAGNOSTICS` if enabled.

### Authentication compromise (S1)

1. Rotate `SUPABASE_SERVICE_ROLE_KEY`.
2. Force session invalidation via Supabase dashboard.
3. Review `SecurityAuditLog` for anomalous access.
4. Rotate OAuth client secrets for affected providers.
5. Revoke connector tokens via disconnect flow.

### ENCRYPTION_KEY compromise (S1)

1. **Do not rotate without plan** — all connector credentials require re-encryption.
2. Disconnect all connectors; require tenant reconnection.
3. Assess data accessed during exposure window.

## Security incidents

If credential exposure is suspected:

1. Rotate compromised credentials immediately.
2. Review audit logs and security audit log.
3. Block abusive IPs if applicable.
4. Preserve logs for forensic analysis.
5. Do not paste secrets into incident tickets.

## Data breach

1. Contain access immediately.
2. Preserve logs (do not delete audit records).
3. Assess affected tenant records and PII categories.
4. Notify legal/compliance per organisational policy and applicable regulations.
5. Document timeline and remediation.
6. Prepare tenant notification if required.

## Communication

| Severity | Internal | External (beta tenants) |
|----------|----------|------------------------|
| S1 | Immediate — all engineering + leadership | Immediate email + status page |
| S2 | Within 1 hour — engineering + product | Within 4 hours — affected tenants |
| S3 | Within 4 hours — engineering | Next business day if user-visible |
| S4 | Ticket only | No notification unless requested |

Status updates every 30 minutes for S1 until resolved.

## Logging and evidence

- Request IDs (`x-request-id`) correlate API errors
- `AuditLog` and `SecurityAuditLog` provide tenant activity trail
- `AIRequest` stores digests (not full prompts) for AI incident review
- Email webhook events in `EmailDeliveryEvent`
- Advertising audit events in `AdvertisingAuditEvent`

Do not paste secrets, tokens, or full PII into incident tickets.

## Escalation contacts

Configure for your organisation:

| Role | Contact | Responsibility |
|------|---------|----------------|
| Engineering lead | | Technical resolution |
| Security lead | | Breach assessment, credential rotation |
| Infrastructure | | Database, hosting, DNS |
| Product owner | | Tenant communication, scope decisions |
| Legal/compliance | | Breach notification, DSR |

## Post-incident review template

1. Timeline of detection → containment → resolution
2. Root cause analysis
3. Affected tenants and data categories
4. What went well / what to improve
5. Action items with owners and deadlines
6. Update runbooks if procedures were insufficient

## Related documents

- `docs/V1_ROLLBACK_PLAN.md`
- `docs/V1_BACKUP_RECOVERY.md`
- `docs/INCIDENT_RESPONSE.md` (Stage 1 baseline)
- `docs/AD_BUDGET_INCIDENT_RUNBOOK.md`
- `docs/AD_PROVIDER_INCIDENT_RUNBOOK.md`
- `docs/SEO_INCIDENT_RESPONSE.md`
