# Instagram Capabilities (Launch Scope)

## Supported in production (live E2E required)

| Content type | Graph container | Notes |
|--------------|-----------------|-------|
| Single image | `IMAGE` | JPEG/PNG via HTTPS URL |
| Carousel | `CAROUSEL` | 2–10 images |
| Reel / short video | `REELS` | Video via HTTPS URL |

## Explicitly unsupported (UI disabled)

- Stories
- Text-only posts
- Polls / threads
- Live video

## Preflight validation

Before queueing, `publish/preflight` checks:

- Content `APPROVED`
- `ProviderConnection` active
- Instagram Business account selected
- Media approved, `READY`, licence valid
- HTTPS provider-accessible URLs (signed Supabase storage)
- Caption within Meta limits (2200 chars via `adaptContentForProvider`)

## Adapter behaviour

`meta-social-publishing-adapter`:

1. Create media container
2. Poll until `FINISHED` (max 12 attempts)
3. `media_publish`
4. Fetch permalink from Graph API

Errors map to customer-safe categories: auth, rate limit, media, policy.
