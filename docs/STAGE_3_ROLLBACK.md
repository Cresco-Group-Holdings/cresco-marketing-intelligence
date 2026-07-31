# Stage 3 Rollback

## Database

Stage 3 migrations are forward-only. Rollback procedure:

1. Deploy previous application version
2. Do **not** drop Stage 3 tables if data must be preserved
3. If migration must be reversed, create a forward migration to archive/disable features

### Migration order (Stage 3)

```
20260730160000_task_3_6_attribution
20260730170000_task_3_7_funnels
20260730180000_task_3_8_revenue
20260730190000_task_3_9_executive
20260730200000_task_3_10_analyst
```

## Feature flags (operational)

Disable features without code rollback:

| Feature | Disable method |
|---------|---------------|
| Stripe webhooks | Remove `STRIPE_WEBHOOK_SECRET` |
| AI analyst | Revoke `ai.analyst.generate` permission |
| Attribution runs | Do not trigger runs |
| Revenue sync | Do not configure Stripe keys |

## Data preservation

- Revenue transactions: preserve on rollback (financial audit)
- Attribution results: preserve (historical analysis)
- Analyst runs: safe to retain; no external side effects

## Recovery

1. Restore database from backup if corruption occurred
2. Re-run `npm run db:migrate:deploy`
3. Verify `/api/readiness`
4. Run smoke tests from `STAGE_3_RELEASE_CHECKLIST.md`
