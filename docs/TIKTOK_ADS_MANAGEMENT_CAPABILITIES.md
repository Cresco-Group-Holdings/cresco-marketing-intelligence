# TikTok Ads Management — Capability Audit (Task 5.6)

Last reviewed: 2026-07-30

## Official API support

| Capability | Status in Cresco | Notes |
|---|---|---|
| TikTok for Business developer access | Enabled | |
| OAuth advertiser access | Enabled | Via existing connector |
| Advertiser listing | Enabled | Explicit selection required |
| Campaign creation | Enabled | Controlled launch only |
| Traffic objective | Enabled | |
| Video views objective | Enabled | |
| Lead generation objective | Enabled | |
| Website conversion objective | Enabled | |
| Short-video ads | Enabled | Initial creative format |
| Spark Ads | **Disabled** | Requires creator identity authorisation — not simulated |
| Automatic placements | Enabled | Default |
| Manual placements | Enabled | When plan specifies platforms |
| Broad audience targeting | Enabled | |
| Interest targeting | Enabled | |
| Retargeting audiences | Enabled | Via audience intelligence |
| Pixel / events tracking | Enabled | Optional pixel assignment |
| Instant forms | Enabled | Extension point |
| Custom audiences | Enabled | |
| Sandbox advertisers | **Disabled** | Separate app tier |
| Policy review | Enabled | Local + provider status |

## Restrictions

- No Spark Ads without creator authorisation
- No autonomous launch or budget increases
- Minimum age 18 enforced in targeting policy
- Local validation does not guarantee TikTok policy approval

## Rate limits

- QPS and daily call limits per app tier
- Handled via error recovery with retry classification

## App review

- TikTok for Business developer account and app review required
