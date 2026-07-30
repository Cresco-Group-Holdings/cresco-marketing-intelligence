# Meta Asset Selection

## Principle

Cresco never auto-selects Meta assets. Every launch requires explicit user selection of:

| Asset | Required | Notes |
|---|---|---|
| Ad account | Yes | `act_{id}` format |
| Facebook Page | Yes | Creative `page_id` |
| Instagram account | When IG placement | Must match Page linkage |
| Pixel / dataset | Recommended | Conversion tracking + CAPI |
| Business | Optional | Stored for audit context |

## Selection flow

1. Connect Meta via Stage 3 connector (`/connectors/meta-ads`)
2. Browse assets at `/advertising/meta/assets`
3. Assign on `/advertising/meta/accounts`
4. Assignment stored in `AdvertisingMetaAdsAccount`

## Validation

- Launch blocked without `facebookPageId` and `adAccountId`
- Instagram placements require `instagramAccountId`
- Currency/timezone fetched from ad account at assignment time

## Permission loss

If Page or ad account access is revoked, status moves to `PERMISSION_LOST` or `ASSET_MISMATCH` and launches are blocked until re-assignment.
