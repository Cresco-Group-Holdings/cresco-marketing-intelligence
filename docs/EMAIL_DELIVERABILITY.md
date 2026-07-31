# Email Deliverability

## Tracked metrics (30-day rolling)

- Delivery rate
- Bounce rate (total and hard)
- Complaint rate
- Unsubscribe rate
- Provider rejection count
- Domain verification status
- Suppression list growth
- Sending volume

## Thresholds

| Metric | Warning | Shutdown |
|--------|---------|----------|
| Bounce rate | 5% | 10% |
| Hard bounce rate | 2% | — |
| Complaint rate | 0.1% | 0.3% |
| Unsubscribe rate | 2% | — |

## Warnings

`detectDeliverabilityWarnings` returns `WARNING` and `CRITICAL` severity items. `CRITICAL` complaint or bounce rates recommend sending shutdown.

## Snapshots

`EmailDeliverabilitySnapshot` records are created on each deliverability view request and retained for historical trending.

## Open tracking disclaimer

Open rates are indicative only. Privacy features, image blocking, and prefetching make opens unreliable engagement evidence. See `OPEN_TRACKING_DISCLAIMER` in tracking policy module.

## API

`GET /api/brands/{brandId}/email?view=deliverability` — requires `email.viewDeliverability`
