# V1 Rollback Plan

Application, database, and feature rollback procedures for V1 production.

## Principles

1. Prefer **forward fixes** (new migration + redeploy) over schema rollback.
2. Never rollback database migrations automatically in production.
3. Use environment flags for immediate feature shutdown.
4. Keep rollback scope limited to application deployment where possible.

## Immediate rollback (< 5 minutes)

### Application rollback (Vercel)

1. Open Vercel project → Deployments.
2. Identify last known-good production deployment.
3. Click **Promote to Production**.
4. Verify:
   - `GET /api/health` → `200`
   - `GET /api/readiness` → `200`
   - Login flow works
5. Monitor error logs for 30 minutes.

### Emergency feature shutdown

| Flag | Effect | Module |
|------|--------|--------|
| `ADVERTISING_EMERGENCY_SHUTDOWN=true` | Blocks all advertising mutations | Stage 5 |
| `SEO_ENGINE_SHUTDOWN=true` | Blocks crawl enqueue | Stage 4 |
| Revoke `emailCampaigns.launch` permission | Blocks campaign launches | Stage 6 |
| Revoke `lifecycleAgent.run` permission | Blocks lifecycle agent runs | Stage 6 |
| Pause automation journeys | Set automations to `PAUSED` | Stage 6 |

Restart application after environment flag changes.

## Feature rollback (per module)

| Module | Rollback action |
|--------|----------------|
| Email campaigns | Revoke `emailCampaigns.launch` for MARKETER; pause active campaigns |
| Marketing automation | Set all journeys to `PAUSED`; stop enrollment processor |
| Lead scoring | Set active model to `PAUSED`; scores frozen at last calculation |
| Lifecycle agent | Revoke `lifecycleAgent.run` and `lifecycleAgent.approve` |
| CRM forms | Set forms to `DRAFT` or `ARCHIVED` |
| Advertising | `ADVERTISING_EMERGENCY_SHUTDOWN=true` + revoke launch permissions |
| SEO crawler | `SEO_ENGINE_SHUTDOWN=true` |
| Social publishing | Revoke publish permissions; cancel scheduled posts |
| AI analyst | Revoke `ai.analyst.generate` permission |
| Stripe revenue | Disable webhook endpoint in Stripe dashboard |

## Database rollback

Prisma does not support automatic down migrations in production.

Stage 6 migrations (additive only):

```
20260730390000 — CRM foundation (6.1)
20260730400000 — Lead capture forms (6.2)
20260730410000 — Sales pipeline (6.3)
20260730420000 — CRM tasks (6.4)
20260730430000 — Email infrastructure (6.5)
20260730440000 — Email campaigns (6.6)
20260730450000 — Marketing automation (6.7)
20260730460000 — Lead scoring (6.8)
20260730470000 — Lifecycle agent (6.9)
```

If migration caused issues:

1. **Stop** further deploys.
2. Assess whether a forward migration can fix the schema safely.
3. If data repair required, restore from backup (see `V1_BACKUP_RECOVERY.md`).
4. Document incident per `V1_INCIDENT_RESPONSE.md`.

To disable features without schema rollback: use permission revocation and env flags.

## Provider rollback

### Email

- Cancel queued messages via campaign pause
- Revoke sending domain if deliverability compromised
- Re-sync suppression lists from provider

### Advertising

- Paused campaigns remain paused in provider (no auto-delete)
- Use provider UI to archive/delete test campaigns
- Revoke OAuth tokens via Settings → Connections

### Social

- Cancel scheduled publishes
- Revoke connector tokens
- Published content remains on platform (manual deletion required)

### Stripe

- Disable webhook endpoint
- Revenue data frozen at last sync

## Configuration rollback

1. Revert environment variables in Vercel to previous values.
2. Redeploy or wait for next deployment.
3. Verify OAuth redirect URLs match `APP_URL`.
4. Verify `ENCRYPTION_KEY` unchanged (rotation requires re-encryption plan).

## Communication

| Severity | Action |
|----------|--------|
| S1 — Critical | Notify all affected beta tenants immediately |
| S2 — High | Notify affected tenants within 4 hours |
| S3 — Medium | In-app banner + email within 1 business day |

Follow `docs/V1_INCIDENT_RESPONSE.md` for stakeholder notification.

## Recovery

1. Resolve root cause
2. Clear emergency shutdown flags
3. Re-enable permissions incrementally (VIEWER → MARKETER → ADMIN)
4. Run V1 E2E smoke scenario on staging
5. Re-run readiness checks
6. Resume with restricted beta scope
7. Post-mortem within 48h for S1/S2 incidents

## When NOT to rollback

- Security patch already deployed — fix forward instead
- Migration already applied with dependent data changes
- Rollback would expose previously fixed vulnerability
- Only typecheck/build failures — fix forward, do not rollback data

## Related documents

- `docs/V1_BACKUP_RECOVERY.md`
- `docs/V1_INCIDENT_RESPONSE.md`
- `docs/STAGE_5_ROLLBACK.md`
- `docs/STAGE_4_ROLLBACK.md`
- `docs/ROLLBACK.md`
