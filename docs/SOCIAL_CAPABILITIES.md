# Social Capabilities

Capabilities reflect actual granted permissions and account type. The system does not assume every connected account supports every feature.

## Capability Types

| Capability | Description |
|------------|-------------|
| `PUBLISH_TEXT` | Post text content |
| `PUBLISH_IMAGE` | Post image content |
| `PUBLISH_CAROUSEL` | Post carousel/multi-image |
| `PUBLISH_VIDEO` | Post video content |
| `PUBLISH_SHORT_VIDEO` | Post short-form video (Reels, Shorts, etc.) |
| `SCHEDULE_NATIVELY` | Native platform scheduling |
| `READ_INSIGHTS` | Read analytics/insights |
| `READ_COMMENTS` | Read comments |
| `MANAGE_COMMENTS` | Reply to or moderate comments |
| `READ_MESSAGES` | Read direct messages |
| `WEBHOOK_SUPPORT` | Platform webhook subscriptions |

## Account Type Baselines

Each account type has a baseline capability set in `src/lib/social/capabilities.ts`:

| Account Type | Baseline Capabilities |
|--------------|----------------------|
| `INSTAGRAM_BUSINESS` | Image, carousel, video, short video, insights, comments, messages |
| `FACEBOOK_PAGE` | Text, image, carousel, video, insights, comments, messages, webhooks |
| `LINKEDIN_ORGANISATION` | Text, image, video, insights, comments |
| `LINKEDIN_MEMBER` | Text, image, insights |
| `TIKTOK_BUSINESS` | Video, short video, insights, comments |
| `YOUTUBE_CHANNEL` | Video, short video, insights, comments |
| `X_ACCOUNT` | Text, image, video, insights, comments, messages, webhooks |

## Scope Intersection

Final capabilities = baseline capabilities ∩ scope-mapped capabilities.

If no scopes map to capabilities, baseline is used (for mock/dev adapters). In production, missing scopes reduce capabilities.

## Missing Scopes

When required OAuth scopes are not granted:

- Connection status: `PERMISSION_MISSING`
- UI shows missing scopes in connection details
- Capabilities limited to intersection of granted scopes and account type

## Storage

Capabilities stored in `SocialAccountCapability` junction table, one row per capability per account.

## Future Tasks

Publishing and analytics tasks will check capabilities before attempting operations.
