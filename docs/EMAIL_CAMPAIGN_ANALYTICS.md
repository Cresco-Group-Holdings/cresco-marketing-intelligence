# Email Campaign Analytics

## Metrics

| Metric | Source | Notes |
|--------|--------|-------|
| Attempted | Send run | Messages queued for dispatch |
| Sent | Provider webhook | Accepted by provider |
| Delivered | Provider webhook | Confirmed delivery |
| Bounced | Bounce webhook | Hard/soft split in bounce table |
| Complained | Complaint webhook | Spam reports |
| Unsubscribed | Unsubscribe webhook/link | Suppression list |
| Opened | Tracking pixel | See limitations |
| Clicked | Link tracking | Requires enabled policy |
| CTA clicks | UTM/redirect tracking | Campaign-specific |
| Conversions | Attribution journey | Requires setup |
| Revenue | Revenue adapter | Estimate only |

## Limitations

Displayed with every analytics view:

- Opens are indicative only (privacy features, image blocking)
- Clicks may not capture all interactions
- Conversions require attributable tracking
- Revenue is estimate-based

## API

`GET /api/brands/{brandId}/email/campaigns?campaignId={id}&view=analytics`

Requires `emailCampaigns.viewAnalytics` permission.

## Snapshots

`EmailCampaignMetricSnapshot` records are created at launch and updated as webhook events arrive.
