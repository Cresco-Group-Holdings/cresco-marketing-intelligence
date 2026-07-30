# SEO AI Runbook

## AI purposes used by SEO Engine

| Purpose | Service | Schema |
|---------|---------|--------|
| `SEO_ANALYSIS` | Keyword, topic, competitor AI | `keyword-output-schemas.ts`, etc. |
| Brief generation | `seo-brief-ai-service.ts` | `brief-output-schemas.ts` |
| Long-form | `long-form-ai-service.ts` | `long-form-output-schemas.ts` |
| On-page review | `on-page-ai-service.ts` | `on-page-output-schemas.ts` |

## Cost controls

| Limit | Default | Env override |
|-------|---------|--------------|
| Per-request tokens | 8,000 | — |
| Org daily tokens | 250,000 | — |
| User daily tokens | 50,000 | — |
| Max input characters | 12,000 | — |
| Rate limit | 60 req/min per org:user | In-memory |

Monitor via `GET /api/ai/usage?organisationId=...` (requires `ai.usage.read`).

## Emergency shutdown

```bash
SEO_AI_EMERGENCY_SHUTDOWN=true
```

All SEO AI generation will be rejected until flag is cleared.

## Prompt injection response

1. `detectPromptInjection()` blocks known patterns
2. Crawled page content treated as untrusted user input
3. Failed requests return `VALIDATION_ERROR` — no provider call made
4. Review `AIRequest` records for `status = FAILED` with injection reason

## Structured output failures

1. Provider response parsed via `parseStructured()` with Zod validation
2. Validation failure → `ai_validation_errors` counter incremented
3. User sees error message; no partial data saved
4. Retry with modified input or use deterministic fallback where available

## Unsupported claims (long-form)

1. `LongFormClaim` records flagged during generation
2. Review queue at `/content/long-form/{id}/review`
3. Claims must be approved before export

## Diagnostics

- `ALLOW_AI_DIAGNOSTICS=false` in production (recommended)
- Diagnostics require `ai.diagnostics` permission

## Incident: runaway AI costs

1. Set `SEO_AI_EMERGENCY_SHUTDOWN=true`
2. Review `AIUsageRecord` for anomalous org/user
3. Reduce `AI_ORGANISATION_DAILY_TOKEN_LIMIT` if needed
4. Re-enable after root cause identified
