# Channel Taxonomy

Marketing channels are normalised in `MarketingChannel` and classified into a consistent taxonomy using brand-scoped rules. This enables cross-source reporting where the same logical channel (e.g. "Paid Search", "Organic Social") aggregates metrics from GA4, Google Ads, and social bridge data.

## Channel model

`MarketingChannel` represents a provider-specific channel or property:

| Field | Purpose |
| --- | --- |
| `provider` | `MarketingDataProvider` (e.g. `GA4`, `INSTAGRAM`, `MANUAL_IMPORT`) |
| `providerChannelId` | Stable provider identifier |
| `name` | Display name |
| `channelType` | Provider-native type (e.g. `ORGANIC_SOCIAL`, `PAID_SEARCH`) |
| `status` | `ACTIVE`, `PAUSED`, `ARCHIVED`, `REMOVED` |
| `providerMetadata` | Provider-specific configuration |

Unique constraint: `[brandId, provider, providerChannelId]`.

Channels link to campaigns, content items, cost records, and metric observations.

## Classified taxonomy

Raw provider channels are mapped to **classified channels** — a brand-normalised vocabulary for reporting:

| Classified channel | Typical sources |
| --- | --- |
| `organic_social` | Instagram, Facebook, LinkedIn, TikTok, YouTube, X |
| `paid_social` | Meta Ads, LinkedIn Ads, TikTok Ads |
| `paid_search` | Google Ads, Microsoft Ads (future) |
| `organic_search` | Google Search Console, GA4 organic |
| `email` | Email provider |
| `direct` | GA4 direct |
| `referral` | GA4 referral |
| `display` | Google Display Network |
| `affiliate` | Affiliate networks |
| `offline` | Manual import, CRM |
| `first_party` | On-platform events |
| `other` | Unmatched channels |

Exact vocabulary is brand-configurable via `MarketingChannelRule.targetChannel`.

## Classification rules

`MarketingChannelRule` defines pattern-based assignment:

| Field | Purpose |
| --- | --- |
| `name` | Rule label |
| `priority` | Lower number = higher precedence (default 100) |
| `matchField` | Field to test (`name`, `channelType`, `providerMetadata.source`, UTM fields, etc.) |
| `matchPattern` | Regex or substring pattern |
| `targetChannel` | Classified channel key |
| `isActive` | Enable/disable without deletion |

Rules are evaluated in priority order. First match wins.

### Example rules

| Priority | Match field | Pattern | Target |
| --- | --- | --- | --- |
| 10 | `provider` | `INSTAGRAM\|FACEBOOK\|LINKEDIN\|TIKTOK\|YOUTUBE\|X` | `organic_social` |
| 20 | `channelType` | `PAID` | `paid_social` |
| 30 | `name` | `(?i)google ads` | `paid_search` |
| 40 | `providerMetadata.utm_medium` | `cpc` | `paid_search` |
| 50 | `providerMetadata.utm_medium` | `email` | `email` |

## Classification records

`MarketingChannelClassification` stores the applied result:

- `classifiedChannel` — resolved taxonomy key
- `confidence` — optional 0–1 score (manual rules = 1.0)
- `marketingChannelRuleId` — rule that matched (null for manual override)
- `classifiedAt` — timestamp

Reclassification creates a new record; historical classifications are retained for lineage.

## UTM-based classification

For `MarketingSession` and event-sourced channels, UTM parameters contribute to classification:

| UTM field | Typical mapping |
| --- | --- |
| `utm_source` | Provider or publisher name |
| `utm_medium` | Channel type (`cpc` → paid search, `social` → organic/paid social) |
| `utm_campaign` | Links to `MarketingCampaign` when resolvable |

Sessions without UTM data classify as `direct` or `other` depending on referrer presence.

## Manual import channels

CSV imports may supply a `channel` or `channel_type` column. The normaliser:

1. Upserts `MarketingChannel` with `provider = MANUAL_IMPORT`
2. Applies active `MarketingChannelRule` set
3. Falls back to `providerMetadata.importedChannel` when no rule matches

## Social bridge channels

Social accounts map to channels via the bridge adapter:

- One `MarketingChannel` per `SocialAccount` (provider-native ID)
- `channelType` set from `SocialProvider` (e.g. `INSTAGRAM` → `organic_social` default)
- Content items link through `MarketingContentItem.providerContentId` ↔ social post ID

## Relationship to GA4 / Ads (deferred)

GA4 property and Google Ads account channels are registered in the source catalogue but not populated by live sync in 3.1. When connector ingest ships (3.2+), channels will be created during normalisation from provider hierarchy APIs.

## API and permissions

- View channels: `marketingData.read`
- Manage rules: `marketingData.manage`
- Manual reclassification: `marketingData.manage` (audit logged)

## Related documentation

- `docs/MARKETING_DATA_MODEL.md` — channel entity relationships
- `docs/METRIC_REGISTRY.md` — metrics by channel dimension
- `docs/MARKETING_EVENTS.md` — session UTM fields
- `docs/NORMALISED_MARKETING_DATA.md` — `NormalisedChannel` type
