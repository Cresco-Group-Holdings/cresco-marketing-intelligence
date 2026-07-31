# V1 Launch Monitoring

Monitoring plan for V1 production launch and first 30 days.

## Launch phases

| Phase | Duration | Focus |
|-------|----------|-------|
| T-0 (deploy) | 0–2 hours | Readiness, smoke tests, error rate |
| T+1 (day 1) | 2–24 hours | All module health, email deliverability |
| T+7 (week 1) | Days 2–7 | Trend analysis, tenant feedback |
| T+30 (month 1) | Days 8–30 | Stability assessment, unrestricted production decision |

## Critical alerts (immediate response)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Health check failed | `/api/health` non-200 for 3 min | S1 | Page on-call; check Vercel/deployment |
| Readiness degraded | `/api/readiness` 503 for 5 min | S1 | Check database connectivity, env vars |
| Database connectivity | Readiness `database` check fails | S1 | Check provider status; connection strings |
| Error rate spike | >10 errors/minute in log drain | S2 | Identify module; consider rollback |
| Cross-tenant access | Any 200 on foreign brandId test | S1 | Incident response immediately |

## Module-specific alerts

### Platform (Stage 1)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Auth failure rate | >20/min per IP | Review rate limit; check for attack |
| Failed login spike | 3x baseline | Check Supabase status |
| AI cost | >daily budget | Review `AIRequest` usage; throttle if needed |
| `connector_diagnostics` warn | Enabled in production | Disable `ALLOW_AI_DIAGNOSTICS` |

### Analytics (Stage 3)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Warehouse sync failures | >5/hour per org | Check connector tokens |
| Stripe webhook failures | Any signature error | Verify `STRIPE_WEBHOOK_SECRET` |
| Executive dashboard errors | >5/hour | Check data source health |
| Analyst validation failures | >10/day | Review evidence packages; expected fallback |

### SEO (Stage 4)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Crawl queue backlog | >1000 PENDING | Check `SEO_ENGINE_SHUTDOWN`; scale workers |
| Crawl failure rate | >20% | Review SSRF blocks; domain verification |
| Rank sync failures | >5/hour | Check licensed API credentials |

### Advertising (Stage 5)

| Metric | Threshold | Action |
|--------|-----------|--------|
| `launch_failure` | >10/hour | Check provider status, OAuth tokens |
| `unauthorised_mutation_attempts` | >0 | Review audit logs |
| `emergency_pauses` | >0 | Investigate spend incident |
| `budget_alerts` CRITICAL | Any | Review pacing dashboard |
| `provider_connection_failures` | >5/hour | OAuth recovery procedure |

### CRM & Email (Stage 6)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Email bounce rate | >5% | Pause campaigns; review list quality |
| Email complaint rate | >0.1% | Pause campaigns; review content |
| Suppression bypass attempt | Any | S1 incident; review `queueMessage` |
| Form quarantine rate | >10% of submissions | Review bot signals; check origin config |
| Automation enrollment errors | >20/hour | Review consent/suppression gates |
| Lifecycle agent blocked runs | >50% of runs | Check data freshness; PII in notes |
| Lead scoring job failures | >5/hour | Review model configuration |
| Stuck email messages | QUEUED >1 hour | Check dispatch worker; provider status |

## Dashboards to monitor

| Dashboard | URL / source | Owner |
|-----------|-------------|-------|
| Vercel deployment | Vercel dashboard | Engineering |
| Readiness | `GET /api/readiness` | Operations |
| Executive data health | `/analytics/executive/data-health` | Operations |
| Email analytics | `/email/campaigns` analytics | Operations |
| Advertising metrics | `GET /api/advertising/metrics` | Operations |
| AI usage | `/api/ai/usage` | Engineering |
| SEO crawl queue | `SeoCrawlQueueItem` count | Operations |
| Error logs | Log drain / SIEM | Engineering |

## Launch day checklist (T-0)

- [ ] Deploy completed; readiness returns 200
- [ ] Smoke test: login, CRM lead create, form submit
- [ ] External uptime monitor active on `/api/health`
- [ ] On-call engineer identified and reachable
- [ ] Rollback deployment identified in Vercel
- [ ] Emergency flags documented and accessible
- [ ] Beta tenant notification sent (launch complete)

## Day 1 review (T+1)

- [ ] Error rate within baseline (<5 errors/minute)
- [ ] No S1/S2 incidents open
- [ ] Email test sends delivered successfully
- [ ] No cross-tenant access reports
- [ ] Connector syncs completing
- [ ] Review support tickets from beta users

## Week 1 review (T+7)

- [ ] Error rate trend stable or declining
- [ ] Email deliverability metrics acceptable (bounce <2%, complaint <0.05%)
- [ ] Automation enrollments processing correctly
- [ ] Lead scoring producing expected distributions
- [ ] Advertising spend within limits (if enabled)
- [ ] AI costs within budget
- [ ] Collect beta user feedback

## Month 1 review (T+30)

- [ ] Assess unrestricted production readiness
- [ ] Typecheck and build gates resolved?
- [ ] Billing plan enforcement expanded?
- [ ] DSR procedure tested?
- [ ] E2E scenario automated or signed off?
- [ ] Post-launch backlog prioritised
- [ ] Decision: continue beta / expand / unrestricted production

## Log correlation

Use these fields to correlate incidents:

| Field | Source |
|-------|--------|
| `requestId` | `x-request-id` header, response `meta.requestId` |
| `organisationId` | Audit logs, API context |
| `brandId` | Brand-scoped operations |
| `aiRequestId` | AI request records |
| `campaignId` | Email campaign operations |
| `enrollmentId` | Automation operations |
| `runId` | Lifecycle agent runs |

## Synthetic monitoring (recommended)

| Check | Frequency | Endpoint |
|-------|-----------|----------|
| Health | 1 min | `GET /api/health` |
| Readiness | 5 min | `GET /api/readiness` |
| Auth flow | 15 min | Login page load (no credentials) |
| Form endpoint | 15 min | OPTIONS on public form endpoint |

## Communication plan

| Event | Channel | Audience |
|-------|---------|----------|
| Launch complete | Email | Beta tenants |
| Planned maintenance | Email + in-app banner | Beta tenants |
| S1 incident | Email + status page | All beta tenants |
| S2 incident | Email | Affected tenants |
| Week 1 summary | Email | Beta tenants + internal |

## Related documents

- `docs/V1_OPERATIONS_RUNBOOK.md`
- `docs/V1_INCIDENT_RESPONSE.md`
- `docs/OBSERVABILITY.md`
- `docs/V1_RELEASE_CHECKLIST.md`
