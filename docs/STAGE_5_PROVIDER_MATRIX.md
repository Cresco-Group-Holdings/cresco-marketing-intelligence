# Stage 5 Provider Matrix

Capability verification for all advertising providers. Unverified capabilities are **disabled**, never simulated.

## Google Ads

| Capability | Available | API version | Notes |
|------------|-----------|-------------|-------|
| OAuth | ✅ | adwords scope | Developer token required |
| Search campaigns | ✅ | v18 | Paused launch default |
| Display / PMax / Video / Shopping | ❌ | — | Not in scope |
| Responsive search ads | ✅ | v18 | |
| Conversion tracking | ✅ | v18 | |
| Smart bidding | ❌ | — | Manual CPC only |
| Policy review polling | ❌ | — | Client-side validation |
| Test accounts | ✅ | v18 | |
| Mutations | ✅ | v18 | Controlled, approval-gated |
| Rate limits | — | — | RESOURCE_EXHAUSTED backoff |

## Meta Ads

| Capability | Available | API version | Notes |
|------------|-----------|-------------|-------|
| OAuth | ✅ | v19+ | ads_read, ads_management |
| App review (non-owned) | ❌ | — | Beta on owned accounts |
| Traffic / conversions | ✅ | v19+ | |
| Lead generation | ✅ | v19+ | |
| CAPI | ✅ | v19+ | Deduplication supported |
| Advantage+ / Catalog | ❌ | — | Not verified |
| Lookalike audiences | ❌ | — | Upload workflow deferred |
| Policy review polling | ❌ | — | Client-side validation |
| Test accounts | ✅ | v19+ | Sandbox |
| Mutations | ✅ | v19+ | Controlled, approval-gated |

## LinkedIn Ads

| Capability | Available | Notes |
|------------|-----------|-------|
| OAuth | ✅ | r_ads, rw_ads |
| Campaign creation | ✅ | |
| Sponsored content | ✅ | Single-image, video |
| Document ads | ❌ | Upload API not verified |
| Lead gen | ✅ | |
| Matched audiences | ❌ | Upload workflow deferred |
| Test accounts | ✅ | |
| Policy review | ✅ | Documented |

## TikTok Ads

| Capability | Available | Notes |
|------------|-----------|-------|
| OAuth | ✅ | Advertiser access |
| Campaign creation | ✅ | |
| Short video ads | ✅ | |
| Spark Ads | ❌ | Creator auth not verified |
| Pixel tracking | ✅ | |
| Sandbox | ❌ | Separate app tier |
| Policy review | ✅ | Documented |

## Capability gate implementation

- Registry: `src/lib/advertising-providers/capability-gates.ts`
- `isCapabilityAvailable()` / `requireCapability()` / `getDisabledCapabilities()`
- UI should call `getDisabledCapabilities()` to show unavailable features
