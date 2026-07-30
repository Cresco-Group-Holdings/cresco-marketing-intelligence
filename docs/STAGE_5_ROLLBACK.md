# Stage 5 Rollback Plan

## Immediate rollback (< 5 minutes)

1. Set `ADVERTISING_EMERGENCY_SHUTDOWN=true` in environment
2. Restart application pods / workers
3. Verify `/api/readiness` shows `advertising_platform: warn`
4. All provider mutations blocked in-platform

## Feature rollback (per module)

| Module | Rollback action |
|--------|----------------|
| Optimisation agent | Disable `advertisingOptimisation.run` permission for MARKETER |
| Budget governance | Trigger organisation freeze via UI |
| Provider launches | Revoke `advertising*Ads.launch` permission |
| AI generation | Set AI emergency shutdown (platform) |

## Database rollback

Stage 5 migrations are additive. Rollback procedure:

1. Do **not** drop tables in production without backup
2. To disable features, use permission revocation and env flags
3. If migration revert required, apply down migrations in reverse order:
   - `20260730380000` — Optimisation agent
   - `20260730370000` — Budget governance
   - `20260730360000` — Experiments
   - `20260730350000` — LinkedIn/TikTok
   - `20260730340000` — Meta Ads
   - (earlier 5.x migrations as needed)

## Provider rollback

- Paused campaigns remain paused in provider (no auto-delete)
- Use provider UI to archive/delete test campaigns
- Revoke OAuth tokens via Settings → Connections

## Communication

1. Notify affected organisations
2. Document incident in `AdvertisingSpendIncident`
3. Post-mortem within 48h for any financial impact

## Recovery

1. Resolve root cause
2. Clear `ADVERTISING_EMERGENCY_SHUTDOWN`
3. Resolve active incidents with restoration approval
4. Re-run readiness checks
5. Resume with restricted beta scope
