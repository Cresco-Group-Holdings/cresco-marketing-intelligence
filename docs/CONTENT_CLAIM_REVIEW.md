# Content Claim Review

Long-form content automatically detects and classifies factual claims.

## Classifications

| Classification | Meaning |
|----------------|---------|
| `SUPPORTED` | Claim has evidence |
| `CITATION_REQUIRED` | Factual claim needs citation |
| `INTERNAL_SOURCE` | References own product/service |
| `EXTERNAL_SOURCE` | Needs external reference |
| `OPINION` | Subjective statement |
| `MARKETING_STATEMENT` | Promotional language |
| `UNVERIFIABLE` | Cannot be verified |

## Rules

1. **AI must not fabricate sources or citations.** URLs are validated; malformed URLs are flagged as `isFabricated`.
2. **Unsupported claims are flagged** with `flagged: true` and `flagReason`.
3. Claims requiring citations block evidence review if unresolved.
4. Marketing superlatives and guarantees are automatically flagged.

## Detection

Claim detection runs:

- On section generation (AI output + heuristic scan)
- On manual section edits (via regeneration trigger)
- During evidence review stage

Implementation: `src/lib/long-form/claim-detection.ts`

## Review workflow

1. Generate sections → claims detected per section
2. Submit evidence review → flagged claims surfaced in UI
3. Add citations via `LongFormCitation` or edit section to remove/qualify claims
4. SEO review shows `unsupportedClaims` count (advisory, not absolute score)

## Cresco-specific compliance

See `src/lib/long-form/compliance-rules.ts` for:

- **Cresco Grants**: no guaranteed funding, deadline changes, eligibility verification
- **Capital Cresco**: no guaranteed returns, analysis vs advice, no invented financial results

Compliance findings are stored in `LongFormContentVersion.complianceSnapshot`.
