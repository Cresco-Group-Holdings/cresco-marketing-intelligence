# Search Intent

## Intent Classes

INFORMATIONAL, NAVIGATIONAL, COMMERCIAL, TRANSACTIONAL, LOCAL, SUPPORT, MIXED, UNKNOWN

## Classification Pipeline

1. **Deterministic** — pattern matching in `intent-classifier.ts`
2. **AI-assisted** — via `seoKeywordAiService.classifyIntentWithAi()` with structured output
3. **Manual override** — user sets intent with `isManualOverride: true`

## Rules

- AI must not overwrite manual classification automatically
- Manual overrides stored in `SeoKeywordIntent` with `overriddenByUserId`
- `primaryIntent` on `SeoKeyword` reflects latest authoritative classification
- AI classifications include `modelId`, `confidence`, and `evidence`

## Deterministic Indicators

| Intent | Patterns |
|--------|----------|
| Informational | "how to", "what is", "guide", "tips" |
| Transactional | "buy", "hire", "book", "apply" |
| Commercial | "best", "review", "compare", "vs" |
| Local | "near me", city names |
| Support | "help", "contact", "troubleshoot" |
| Navigational | brand name match, "login", "official" |
