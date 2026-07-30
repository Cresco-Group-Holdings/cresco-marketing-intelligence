# Ad Provider Capability Gates

Unavailable provider capabilities remain **disabled**, never simulated.

## Gate behaviour

1. Each capability has `available: boolean` and optional `reason`
2. `requireCapability()` throws before any provider mutation when disabled
3. UI displays disabled capabilities with reasons
4. Draft mapper checks gates for format-specific features (e.g. Spark Ads, document ads)

## Provider registries

- `LINKEDIN_ADS_CAPABILITIES` — `src/lib/advertising-providers/capability-gates.ts`
- `TIKTOK_ADS_CAPABILITIES` — `src/lib/advertising-providers/capability-gates.ts`

## Disabled by default

| Provider | Capability | Reason |
|---|---|---|
| LinkedIn | Document ads | Additional upload API not verified |
| LinkedIn | Matched audiences | Separate upload workflow |
| TikTok | Spark Ads | Requires creator identity authorisation |
| TikTok | Sandbox advertisers | Separate app tier |

## Enforcement points

- Adapter `executeApprovedPlan()` — `requireCapability('campaign_create')`
- Objective mapper — checks objective-specific capability
- Creative validation — blocks unverified formats
- UI overview — lists all disabled capabilities

## Adding new capabilities

1. Verify against official provider documentation
2. Add to capability registry with `available: true`
3. Implement adapter method
4. Add tests for capability gate
5. Update capability audit doc

Do not enable a capability without verified API support.
