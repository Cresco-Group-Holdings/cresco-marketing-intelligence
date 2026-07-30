# Ad Copy Generation

AI generates structured copy fields respecting provider-specific limits.

## Supported fields

- headline, longHeadline, primaryText, description, cta
- displayPath, callout, sitelink
- videoHook, caption, thumbnailText

## Rules

1. **Do not truncate silently** — fields exceeding limits produce `truncationWarning` on `AdvertisingCreativeCopy`.
2. Copy generation uses `advertising.creatives.copy` schema with evidence, assumptions, compliance risks, and disclaimer.
3. Brand context from Knowledge Base informs tone, prohibited claims, and approved messaging.
4. AI must not fabricate statistics or guaranteed outcomes.

## Provider limits

Limits are defined in `src/lib/advertising-creatives/format-specs.ts` per `AdvertisingCreativeFormatType`.

## Workflow

1. Create creative project with format
2. Generate concepts (`generate-concepts`)
3. Generate copy (`generate-copy`)
4. Review truncation warnings
5. Lock approved fields (`lock-copy`)
6. Submit for compliance review
