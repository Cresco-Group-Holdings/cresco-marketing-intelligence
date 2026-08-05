# Rollback Plan

**Audit date:** 2026-08-05  
**Consolidates:** `docs/V1_ROLLBACK_PLAN.md`

## Principles

1. Prefer **forward fixes** (new migration + redeploy) over schema rollback
2. Never rollback database migrations automatically in production
3. Use environment flags for immediate feature shutdown
4. Keep rollback scope limited to application deployment where possible

## Immediate rollback (< 5 minutes)

### Application rollback (Vercel)

1. Open Vercel project → Deployments
2. Identify last known-good production deployment
3. Click **Promote to Production**
4. Verify:
   - `GET /api/health` → 200
   - `GET /api/readiness` → 200
   - Login flow works
5. Monitor error logs for 30 minutes

### Emergency feature shutdown

| Flag | Effect |
|------|--------|
| `ADVERTISING_EMERGENCY_SHUTDOWN=true` | Blocks all advertising mutations |
| `SEO_ENGINE_EMERGENCY_SHUTDOWN=true` | Blocks crawl enqueue |
| `EMAIL_EMERGENCY_SHUTDOWN=true` | Blocks email dispatch |
| `PUBLISHING_EMERGENCY_SHUTDOWN=true` | Blocks outbound publishing |
| `PROVIDER_LIVE_CALLS_ENABLED=false` | Forces mock/stub provider responses |

Restart application after environment flag changes.

## Feature rollback (per module)

| Module | Rollback action |
|--------|-----------------|
| Email campaigns | Revoke `emailCampaigns.launch`; pause active campaigns |
| Marketing automation | Set journeys to `PAUSED` |
| Advertising | Emergency shutdown flag + revoke launch permissions |
| Publishing | Revoke publish permissions; cancel scheduled posts |
| Provider sync | Disable connection; stop cron triggers |
| AI features | Revoke `ai.*` permissions |
| Notifications | No rollback needed — read-only degradation acceptable |

## Database rollback

**Not supported automatically.** If schema corruption occurs:

1. Stop application traffic (maintenance mode)
2. Restore from pre-migration backup
3. Promote last known-good application deployment
4. Verify data integrity
5. Post-incident review per `INCIDENT_RESPONSE_PLAN.md`

## Rollback testing

| Test | Procedure | Last verified |
|------|-----------|---------------|
| Vercel promote | Promote previous deployment in staging | Manual — required pre-launch |
| Emergency shutdown | Set flag; verify mutation blocked | Unit tests for flags |
| Backup restore | Restore staging DB from snapshot | Manual — required pre-launch |

## Rollback decision matrix

| Symptom | Severity | Action |
|---------|----------|--------|
| Error rate > 10/min | S2 | Investigate; rollback if not resolved in 15 min |
| Cross-tenant data leak | S1 | Immediate rollback + incident response |
| Auth completely broken | S1 | Immediate rollback |
| Single module failure | S3 | Feature flag shutdown; no full rollback |
| Migration failure | S1 | Stop deploy; restore backup if needed |

## Post-rollback

1. Create incident record with timeline
2. Identify root cause before re-deploying
3. Add regression test if applicable
4. Update `RELEASE_BLOCKERS.md` if new blocker found
