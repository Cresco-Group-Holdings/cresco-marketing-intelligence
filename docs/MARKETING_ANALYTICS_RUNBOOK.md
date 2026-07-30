# Marketing Analytics Runbook

## Daily operations

### Check data health
1. Navigate to `/analytics/executive/data-health` or `/data/health`
2. Review unhealthy/degraded sources
3. Re-sync failed connectors from `/connectors`

### Review executive KPIs
1. Open `/analytics/executive`
2. Check operational warnings banner
3. Verify Unavailable metrics — investigate missing sources

### Run AI brief (weekly)
1. Open `/analyst`
2. Click "Weekly executive brief"
3. Review evidence drawer and save if needed

## Incident response

### Stale data
- Check `marketingDataSourceHealth` status
- Trigger manual sync: `/api/brands/[brandId]/revenue/sync` or connector sync
- Review `docs/DATA_FRESHNESS.md`

### Stripe webhook failures
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check signature errors in logs (sanitised)
- Ensure `brand_id` in Stripe metadata

### AI analyst validation failures
- System falls back to deterministic output automatically
- Check evidence package for missing metrics
- Review `aiRequestId` in analyst run record

### Cross-tenant access attempt
- Should return 403/404 from `brandService.getById`
- Review audit logs for suspicious access patterns

## Sync procedures

| Source | Route / UI |
|--------|-----------|
| Warehouse | `/data` → sync |
| Stripe | `/analytics/revenue` → Sync Stripe |
| GSC | `/analytics/search` → sync |
| Paid ads | `/connectors` → sync |
| Social | `/analytics/social` → sync |

## E2E validation scenario

See `docs/STAGE_3_RELEASE_CHECKLIST.md` smoke tests and Task 3.10 acceptance criteria:

1. Tracking property → warehouse events
2. GA4 + GSC + ads connected
3. Signup conversion → attribution journey
4. Payment → revenue on executive dashboard
5. AI analyst → evidence-linked findings
6. Cross-tenant isolation verified

## Contacts

- Engineering: see repository maintainers
- On-call: follow `docs/INCIDENT_RESPONSE.md`
