# Social inbox capabilities audit

Verified against official provider documentation on 2026-07-29. This document defines what the unified inbox may implement per provider. Direct-message support is enabled only where official APIs, account types, and granted permissions allow it.

## Summary matrix

| Provider | Read comments | Reply | Mentions | Direct messages | Webhooks | Polling fallback |
|----------|---------------|-------|----------|-----------------|----------|------------------|
| Instagram (Business/Creator) | Yes (Graph API) | Yes (with `instagram_manage_comments`) | Limited (tags in media/comments) | No in MVP — Messaging API requires separate Messenger permissions | Meta webhooks for comments | Yes |
| Facebook Page | Yes | Yes (`pages_manage_engagement`) | Yes (Page tags/mentions) | Yes (Page messaging, `pages_messaging`) | Yes (Page webhooks) | Yes |
| LinkedIn Organisation | Yes (Community Management API) | Yes (org admin/content roles) | Limited | No | No | Yes |
| LinkedIn Member | No | No | No | No | No | No |
| TikTok Business | Limited / product-gated | Limited | No official mention inbox | No | No | Yes (where API permits) |
| YouTube Channel | Yes (commentThreads.list) | Yes (`youtube.force-ssl`) | Via comment text | No | PubSubHubbub optional | Yes |
| X Account | Yes (filtered stream/search) | Yes (`POST /2/tweets` reply) | Yes | Yes (DM API — paid tier, `dm.read`/`dm.write`) | Account Activity API (paid) | Yes |

## Instagram

| Capability | Support | Notes |
|------------|---------|-------|
| Comment reading | Supported | `/{ig-media-id}/comments` via Instagram Graph API with `instagram_basic` + `instagram_manage_comments` or `pages_read_engagement` |
| Reply | Supported | `POST /{comment-id}/replies` with `instagram_manage_comments` |
| Mentions | Partial | @mentions appear in comment text; no standalone mentions feed without media context |
| Direct messages | **Not in MVP** | Instagram Messaging uses Messenger Platform; requires `instagram_manage_messages` and Facebook Page linkage |
| Webhooks | Supported | Meta `comments` field on `instagram` object via Page subscription |
| Required permissions | `instagram_basic`, `instagram_manage_comments`, `pages_read_engagement`, `pages_show_list` | App Review required for production |
| Retention | Provider-defined | Meta may limit historical comment depth; sync cursors preserve incremental state |
| Platform review | Meta App Review | Required for non-role users |

## Facebook Page

| Capability | Support | Notes |
|------------|---------|-------|
| Comment reading | Supported | `/{page-post-id}/comments` |
| Reply | Supported | `POST /{comment-id}/comments` with Page token |
| Mentions | Supported | Page mention and tagging webhooks |
| Direct messages | Supported | Messenger Platform with `pages_messaging` |
| Webhooks | Supported | `feed`, `mention`, `messages` fields on Page object |
| Required permissions | `pages_manage_engagement`, `pages_read_engagement`, `pages_messaging` (DM only) | Page `MODERATE` or `MANAGE` task |
| Retention | Provider-defined | Deleted comments return `is_hidden` / removed state |
| Platform review | Meta App Review | Required for production |

## LinkedIn

| Capability | Support | Notes |
|------------|---------|-------|
| Comment reading | Supported (org) | Community Management / Social Actions APIs for organisation posts |
| Reply | Supported (org) | Requires `w_organization_social` and admin/content role |
| Mentions | Limited | @organisation mentions in comment body |
| Direct messages | **Not supported** | No public organic DM inbox API for marketing use case |
| Webhooks | Not supported | Polling only |
| Required permissions | `r_organization_social`, `w_organization_social` | LinkedIn product access + review |
| Retention | Provider-defined | |
| Platform review | LinkedIn Marketing Developer Platform | Organisation product approval |

## TikTok

| Capability | Support | Notes |
|------------|---------|-------|
| Comment reading | Limited | Research/Display APIs vary by approval; comment list may be restricted |
| Reply | Limited | Comment management not universally available on Content Posting API |
| Mentions | Not supported | No first-class mention inbox API |
| Direct messages | **Not supported** | No official marketing DM API |
| Webhooks | Not supported | Polling where comment endpoints are granted |
| Required permissions | `video.list` / research scopes as approved | TikTok audit for elevated access |
| Retention | Provider-defined | |
| Platform review | TikTok app audit | Required for public-scope features |

## YouTube

| Capability | Support | Notes |
|------------|---------|-------|
| Comment reading | Supported | `commentThreads.list` with `youtube.force-ssl` |
| Reply | Supported | `comments.insert` as channel reply |
| Mentions | Via comment text | Parsed from `snippet.textDisplay` |
| Direct messages | **Not supported** | No YouTube DM API |
| Webhooks | Optional | PubSubHubbub for channel activity; polling is primary |
| Required permissions | `youtube.force-ssl` | OAuth user channel owner |
| Retention | Provider-defined | Deleted comments marked `snippet.moderationStatus` |
| Platform review | Google OAuth verification | For sensitive scopes in production |

## X (Twitter)

| Capability | Support | Notes |
|------------|---------|-------|
| Comment reading | Supported | Replies via `GET /2/tweets/search/recent` or filtered stream (tier-dependent) |
| Reply | Supported | `POST /2/tweets` with `reply.in_reply_to_tweet_id` |
| Mentions | Supported | `@username` mentions via search/stream |
| Direct messages | Supported (tier-gated) | `dm.read`, `dm.write` — requires elevated/paid API access |
| Webhooks | Supported | Account Activity API (paid) |
| Required permissions | `tweet.read`, `tweet.write`, `users.read`; `dm.read`/`dm.write` for DMs | Paid API tier |
| Retention | Tier limits | Recent search window applies |
| Platform review | X developer agreement | Elevated access for DMs and webhooks |

## Implementation rules

1. **Capability gating** — Every ingest and reply operation checks `SocialAccountCapability` (`READ_COMMENTS`, `MANAGE_COMMENTS`, `READ_MESSAGES`, `WEBHOOK_SUPPORT`).
2. **DM guard** — `DIRECT_MESSAGE` conversations are created only when the account has `READ_MESSAGES` and the provider documents DM support.
3. **Manual fallback** — When reply APIs are unavailable, the UI offers “Copy reply” for manual posting.
4. **No automated moderation decisions** — Safety flags surface for human review; hide/moderate actions require explicit user permission (`socialInbox.moderate`).
5. **Tenant isolation** — All inbox records are scoped by `organisationId`, `brandId`, and `socialAccountId`.

## Known limitations

- OAuth adapters may still use mock tokens in local development; inbox adapters follow the same production/mock split as analytics.
- TikTok and LinkedIn member accounts have the most limited inbox coverage.
- Instagram DMs are excluded until Messenger permissions are connected.
- X DM and webhook features require paid API entitlements not assumed in all deployments.
