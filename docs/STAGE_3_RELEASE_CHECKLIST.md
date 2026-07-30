# Stage 3 Release Checklist

## Pre-release

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (677+ tests)
- [ ] `npm run build` passes
- [ ] `npm run db:migrate:deploy` on staging
- [ ] Environment variables set (see below)
- [ ] OAuth redirect URIs configured for all connectors
- [ ] Stripe webhook endpoint registered (if using revenue)

## Environment variables

```
DATABASE_URL, DIRECT_URL
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (optional)
Connector credentials per provider
ALLOW_TEST_AUTH=false (production)
ALLOW_AI_DIAGNOSTICS=false (production)
```

## Smoke tests

1. Create tracking property → events in warehouse
2. Connect GSC → search metrics appear
3. Run attribution model → credits calculated
4. Create funnel → analysis run completes
5. Executive dashboard → KPIs show Available/Unavailable correctly
6. AI analyst → question returns evidence-linked findings
7. Cross-tenant access denied for foreign brandId

## Post-release monitoring

- `/api/health` and `/api/readiness`
- Warehouse freshness dashboard at `/data/health`
- Executive warnings at `/analytics/executive`
- AI usage at `/api/ai/usage`

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Product | | |
