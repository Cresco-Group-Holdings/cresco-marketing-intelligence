# Video Rendering Runbook

Operational guide for video asset preparation and publishing. **Note: Video Studio UI is not implemented on `main`.** This runbook covers the video publishing path that exists today.

## Current state

| Component | Status on `main` |
|-----------|------------------|
| Video Studio (creation/editing UI) | **Not implemented** |
| Video upload via Visual Studio / asset library | Supported |
| TikTok video publishing | Supported |
| YouTube Shorts publishing | Supported |
| Instagram Reels publishing | Supported (via short video capability) |
| Facebook Reel publishing | Supported |
| Server-side video transcoding | **Not implemented** |

## Supported video formats

| Provider | Formats | Constraints |
|----------|---------|-------------|
| TikTok | MP4, MOV | Validated via `validateTikTokVideo`; max duration per creator info |
| YouTube Shorts | MP4, QuickTime | Vertical (≤ 9:16), ≤ 180 seconds |
| Instagram Reels | MP4 | Via `PUBLISH_SHORT_VIDEO` capability |
| Facebook Reels | MP4 | Via `publishAsReel` setting |
| LinkedIn | MP4 | Via `PUBLISH_VIDEO` capability |
| X | MP4 | Via media upload adapter |

## Video asset requirements

Before publishing, video assets must be:
1. Uploaded to the brand asset library
2. Status: `READY`
3. `approvedForMarketing`: true
4. `licenceExpiresAt`: null or in the future
5. Attached to the content variant via Visual Studio

## TikTok publishing flow

1. User configures TikTok posting settings (privacy, interactions, commercial content)
2. Settings stored in `TikTokPublishSetting` per variant
3. Video validated against creator info from TikTok API
4. Publishing job uploads video and polls for completion
5. If app not approved: manual fallback with URL confirmation

### TikTok troubleshooting

| Issue | Action |
|-------|--------|
| "Confirm posting settings" | User must save TikTok settings before publish |
| Video validation failed | Check duration, format, and creator max duration |
| Manual fallback required | App not approved — user publishes manually and confirms URL |
| Polling timeout | Check `pollingAttemptCount` (max 20); job fails after limit |

## YouTube Shorts flow

1. Video must be vertical (width/height ≤ 9/16 + tolerance)
2. Duration ≤ 180 seconds
3. Optional `scheduledPublishAt` for future publication
4. Resumable upload with persisted `providerUploadState`

### YouTube troubleshooting

| Issue | Action |
|-------|--------|
| "Vertical video required" | Re-export with 9:16 aspect ratio |
| "Duration exceeds 180s" | Trim video or use long-form path (not implemented) |
| Quota exceeded | Check Google Cloud Console quota; wait or request increase |
| Upload interrupted | Worker resumes from `providerUploadState` |

## Instagram/Facebook video

- Uses Meta container API with 24-hour container expiry
- Bounded polling: 12 attempts with exponential backoff
- Container state persisted in `providerContainerId`

## Storage and signed URLs

- Videos served to providers via signed storage URLs (TTL: 3600 seconds)
- URLs generated at publish time from `createObjectStorageProvider`
- If publish takes longer than TTL, job may fail — retry will generate fresh URL

## Future: Video Studio

When Video Studio is implemented (separate branch), this runbook should be updated to cover:
- Server-side rendering pipeline
- Template-based video generation
- Thumbnail extraction and selection
- Render queue and progress tracking
- Failed render recovery

Until then, users must prepare videos externally and upload via the asset library.

## Emergency procedures

### Stop all video publishing
```bash
PUBLISHING_EMERGENCY_SHUTDOWN=true
```

### Stop video publishing per provider
```bash
PUBLISHING_DISABLE_TIKTOK=true
PUBLISHING_DISABLE_YOUTUBE=true
PUBLISHING_DISABLE_INSTAGRAM=true
```

## Related

- `docs/PUBLISHING_INCIDENT_RUNBOOK.md`
- `docs/SOCIAL_PROVIDER_RUNBOOK.md`
- `docs/STAGE_2_KNOWN_LIMITATIONS.md` — Video studio not on `main`
