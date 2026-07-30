# Advertising Creative Studio

Task 5.2 introduces a multi-format advertising creative system for generating, reviewing, and approving ad copy, static creatives, carousels, and video concepts.

**No creative is published automatically.**

## Models

| Model | Purpose |
|-------|---------|
| `AdvertisingCreativeProject` | Root creative project linked to campaign plan |
| `AdvertisingCreativeConcept` | AI/human concept proposals |
| `AdvertisingCreativeVariant` | Structured variants linked to one hypothesis |
| `AdvertisingCreativeCopy` | Provider-aware copy fields with length tracking |
| `AdvertisingCreativeAsset` | Media with provenance (Image Studio, Asset Library, etc.) |
| `AdvertisingCreativeFormat` | Format specs (ratio, duration, text limits) |
| `AdvertisingCreativeReview` | Multi-role review decisions |
| `AdvertisingCreativeVersion` | Version snapshots for comparison |
| `AdvertisingCreativeProviderValidation` | Local pre-check results |
| `AdvertisingCreativePerformanceLink` | Prepared link to imported performance (post-publish) |

## Creative inputs

Projects integrate with campaign plans, brand knowledge, compliance rules, Asset Library, Visual Studio, Content Studio, and SEO pages.

## API

- `GET/POST /api/brands/[brandId]/advertising/creatives`
- `GET/POST /api/brands/[brandId]/advertising/creatives/[creativeId]`

Actions: `generate-concepts`, `generate-copy`, `add-variant`, `update-copy`, `attach-asset`, `validate-provider`, `submit-review`, `review`, `create-version`, `lock-copy`

## UI routes

- `/advertising/creatives`
- `/advertising/creatives/new`
- `/advertising/creatives/[creativeId]`
- `/advertising/creatives/[creativeId]/variants`
- `/advertising/creatives/[creativeId]/review`
- `/advertising/creatives/[creativeId]/validation`
- `/advertising/creatives/[creativeId]/history`

## Related docs

- [Ad copy generation](./AD_COPY_GENERATION.md)
- [Creative formats](./AD_CREATIVE_FORMATS.md)
- [Compliance](./AD_CREATIVE_COMPLIANCE.md)
- [Provider validation](./AD_PROVIDER_VALIDATION.md)
- [Provenance](./AD_CREATIVE_PROVENANCE.md)
