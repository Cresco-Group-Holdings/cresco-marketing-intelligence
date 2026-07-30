# SEO Incident Response

## Severity levels

| Level | Definition | Response time |
|-------|------------|---------------|
| SEV-1 | Active SSRF exploit, data breach, cross-tenant leak | Immediate |
| SEV-2 | Crawl engine down, AI cost runaway, mass data corruption | < 1 hour |
| SEV-3 | Elevated failures, provider outage, single-tenant issue | < 4 hours |
| SEV-4 | Minor bug, documentation issue | Next sprint |

## Immediate actions by severity

### SEV-1: Security breach

1. `SEO_ENGINE_EMERGENCY_SHUTDOWN=true`
2. `SEO_AI_EMERGENCY_SHUTDOWN=true`
3. Rotate `PUBLISHING_WORKER_TOKEN`
4. Rotate OAuth/API credentials
5. Preserve logs and `AIRequest` records
6. Notify security team and affected customers

### SEV-2: Engine failure

1. Check `/api/readiness`
2. Check database connectivity
3. Review `crawl_failures` metric
4. Enable emergency shutdown if uncontrolled
5. Rollback deploy if recent release (see `STAGE_4_ROLLBACK.md`)

### SEV-3: Provider outage

1. Document provider status
2. Pause rank sync schedules
3. Communicate GSC/AI delay to users
4. Enable deterministic fallbacks where available

## Investigation checklist

- [ ] Identify affected organisations (`organisationId`)
- [ ] Check `/api/seo/metrics` counters
- [ ] Review recent deployments
- [ ] Check worker token auth logs
- [ ] Review `ssrf_attempts` and blocked URLs
- [ ] Check AI usage for anomalies

## Communication template

```
Subject: [SEV-X] SEO Engine Incident — {brief description}

Impact: {what users cannot do}
Affected: {scope — all users / specific orgs}
Status: {investigating / mitigated / resolved}
Workaround: {if any}
ETA: {if known}
```

## Post-incident

1. Complete post-mortem within 48 hours (SEV-1/2)
2. Update runbooks with lessons learned
3. Add regression test if applicable
4. Update `STAGE_4_KNOWN_LIMITATIONS.md` if new limitation discovered

## Contacts

- Engineering on-call: {configure per organisation}
- Security: {configure per organisation}
- Cursor Cloud Agent PR: reference Stage 4 branch for fixes
