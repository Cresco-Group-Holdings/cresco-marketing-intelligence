# SEO Provider Runbook

## Supported providers

| Provider | Module | Auth | Sync |
|----------|--------|------|------|
| Google Search Console | Task 3.4 / 4.2 | OAuth connector | `gsc-sync-service` |
| Rank tracking (manual) | Task 4.9 | N/A | CSV/API import |
| Rank tracking (licensed) | Task 4.9 | Provider API key | `seo-rank-observation-service` |
| AI (OpenAI/Anthropic) | AI Core | API key | `ai-request-service` |

## Search Console

### Connection

1. Navigate to `/connectors/google-search-console`
2. Complete OAuth flow
3. Select property matching `SeoSite.primaryDomain`

### Sync

- POST `/api/brands/{brandId}/gsc?action=sync`
- Data delay: 2–3 days (documented)
- Keyword bridge: POST `/api/brands/{brandId}/seo/keywords/opportunities?action=sync-gsc`

### Troubleshooting

| Issue | Resolution |
|-------|------------|
| Token expired | Reconnect via connectors UI |
| No data | Verify property URL match |
| Stale data | Normal GSC delay; check `lastSyncAt` |

## Rank tracking providers

### Manual import

```json
POST /api/brands/{brandId}/seo/rankings/{projectId}
{
  "action": "import",
  "trackedKeywordId": "...",
  "observations": [{
    "source": "MANUAL_IMPORT",
    "observedDate": "2026-07-01",
    "rank": 5,
    "rankingUrl": "https://example.com/page"
  }]
}
```

### Provider sync failure

1. Check `SeoRankTrackingProject.lastSyncStatus`
2. `rank_sync_failures` counter in `/api/seo/metrics`
3. `PROVIDER_SYNC_FAILURE` rank change generated
4. Re-authenticate provider credentials

## AI providers

- Model allowlist: `src/lib/ai/model-registry.ts`
- Disable model: set `available: false` in registry
- Emergency: `SEO_AI_EMERGENCY_SHUTDOWN=true`

## Provider limitations

- GSC: no exact rank, no search volume
- No scraping of Google/Bing SERPs
- Competitor rank data requires licensed provider or manual entry
- AI providers subject to rate limits and outages
