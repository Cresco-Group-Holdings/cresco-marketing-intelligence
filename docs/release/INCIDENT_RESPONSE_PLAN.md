# Incident Response Plan

**Audit date:** 2026-08-05  
**Consolidates:** `docs/V1_INCIDENT_RESPONSE.md`, `docs/INCIDENT_RESPONSE.md`

## Severity levels

| Level | Definition | Response time | Example |
|-------|------------|---------------|---------|
| **S1** | Critical — data breach, auth down, cross-tenant leak | 15 minutes | Credential exposure, tenant data leak |
| **S2** | Major — core workflow broken for all users | 1 hour | Publishing completely broken |
| **S3** | Minor — degraded module, workaround exists | 4 hours | Single provider sync failing |
| **S4** | Low — cosmetic, no data impact | Next business day | UI label error |

## Incident intake

1. **Support email:** Configure per `docs/V1_SUPPORT_RUNBOOK.md`
2. **Collect:** Request ID from error response or `X-Request-Id` header
3. **Template:**

```
Title: [S1/S2/S3] Brief description
Environment: production / staging
Request ID: req_...
User/Org: (if known)
Steps to reproduce:
Expected:
Actual:
Impact: number of users / tenants
```

## Response workflow

```
Detect → Triage → Contain → Resolve → Communicate → Post-mortem
```

### 1. Detect
- Monitoring alerts (`docs/V1_LAUNCH_MONITORING.md`)
- Support tickets
- Error log drain (>10 errors/min)

### 2. Triage
- Assign severity (S1–S4)
- Identify affected module and tenants
- Check `RELEASE_BLOCKERS.md` for known issues

### 3. Contain
| Severity | Immediate action |
|----------|-----------------|
| S1 | Emergency shutdown flags; consider Vercel rollback |
| S2 | Feature flag shutdown for affected module |
| S3 | Disable specific provider connection |
| S4 | Schedule fix |

### 4. Resolve
- Forward fix preferred (new deploy)
- Database: forward migration only
- See `ROLLBACK_PLAN.md` if application rollback needed

### 5. Communicate
- S1/S2: Status update to affected beta tenants within 1 hour
- S3/S4: Include in weekly status or release notes
- Service status: email or in-app announcement banner

### 6. Post-mortem
- Within 5 business days for S1/S2
- Document: timeline, root cause, action items
- Update `POST_LAUNCH_BACKLOG.md`

## Launch-specific incidents (first 72 hours)

| Alert | Threshold | Action |
|-------|-----------|--------|
| Auth failure rate | >20/min per IP | Check Supabase status; rate limits |
| Onboarding completion | <50% of signups | Check redirect policy; wizard errors |
| API 5xx | >10/min | Check deployment; rollback if spike |
| Provider sync failures | >5/hour per org | Check tokens; disable connection |
| Publication failures | >10/hour | Check provider gateway; emergency shutdown |
| Cross-tenant access | Any confirmed | **S1** — immediate rollback |
| AI cost spike | >daily budget | Throttle; review `AIRequest` logs |

## Escalation

| Role | Responsibility |
|------|----------------|
| On-call engineer | First response, containment |
| Engineering lead | Rollback decision, S1/S2 coordination |
| Product | Customer communication, scope decisions |
| Legal | Data breach, privacy incidents |

## Emergency contacts

Configure before launch:
- On-call rotation (PagerDuty/Opsgenie or equivalent)
- Engineering lead contact
- Supabase support (if production tier)
- Vercel support

## Related documents

- `ROLLBACK_PLAN.md` — application rollback
- `docs/V1_LAUNCH_MONITORING.md` — monitoring thresholds
- `docs/V1_SUPPORT_RUNBOOK.md` — customer support procedures
