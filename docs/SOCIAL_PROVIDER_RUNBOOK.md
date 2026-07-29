# Social Provider Runbook

Operational guide for managing social provider connections and configuration.

## Provider overview

| Provider | OAuth scopes (key) | Publishing | Analytics | App review required |
|----------|-------------------|------------|-----------|---------------------|
| Instagram | `instagram_content_publish`, `instagram_manage_insights` | Yes | Yes | Yes (Meta) |
| Facebook | `pages_manage_posts`, `pages_read_engagement` | Yes | Yes | Yes (Meta) |
| LinkedIn | `w_member_social`, `r_organization_social` | Yes | Yes | Yes |
| TikTok | `video.upload`, `video.publish` | Yes | Yes | Yes |
| YouTube | `youtube.upload`, `youtube.readonly` | Yes (Shorts) | Yes | Yes (Google) |
| X | `tweet.write`, `tweet.read` | Yes | Yes | Tier-dependent |

See provider capability docs: `docs/INSTAGRAM_API_CAPABILITIES.md`, `docs/TIKTOK_API_CAPABILITIES.md`, etc.

## Connection lifecycle

### Connect
1. User initiates connect from brand settings → Social Connections
2. OAuth flow redirects to provider authorization
3. Callback stores encrypted tokens via `socialCredentialService`
4. Capabilities detected from granted scopes and account type
5. User assigns discovered accounts to the brand

### Reconnect
- Triggered when `reconnectRequiredAt` is set or status is `REAUTH_REQUIRED`
- User clicks Reconnect → new OAuth flow → tokens replaced
- Existing publishing schedules for the account remain but will fail until reconnected

### Disconnect
1. User clicks Disconnect
2. Encrypted credentials deleted from `SocialConnectionCredential`
3. Account status set to `DISCONNECTED`
4. Pending schedules should be cancelled manually

## Capability management

Capabilities stored in `SocialAccountCapability` table. Check before publishing:

```
PUBLISH_TEXT, PUBLISH_IMAGE, PUBLISH_CAROUSEL, PUBLISH_VIDEO, PUBLISH_SHORT_VIDEO, READ_INSIGHTS
```

If a user reports "account lacks capability":
1. Check granted scopes on `SocialConnection`
2. Verify account type matches expected type (e.g. `INSTAGRAM_BUSINESS`)
3. Have user reconnect and grant all requested permissions
4. Check `docs/SOCIAL_CAPABILITIES.md` for scope-to-capability mapping

## Emergency provider shutdown

Disable publishing for a specific provider without redeploying code:

```bash
# Disable Instagram publishing
PUBLISHING_DISABLE_INSTAGRAM=true

# Disable all publishing globally
PUBLISHING_EMERGENCY_SHUTDOWN=true
```

These are read at call time. Set in Vercel environment variables and the next scheduler/worker invocation will honour them.

To re-enable, remove or set to `false` and wait for next invocation.

## Provider app configuration

### Meta (Instagram/Facebook)
- App must be in Live mode for production accounts
- Redirect URI: `{APP_URL}/api/social/oauth/callback`
- Webhook subscriptions for comments (future inbox) require `pages_manage_metadata`

### TikTok
- Content Posting API requires app review
- Direct publish unavailable until app approved — manual fallback path active
- Creator info must be fetched before each publish (privacy settings)

### LinkedIn
- Organisation posting requires admin role on the LinkedIn Page
- Member posting uses `w_member_social` scope

### YouTube
- Shorts-only implementation (vertical video, ≤ 180 seconds)
- Quota: 10,000 units/day default; upload costs 1,600 units

### X
- API tier determines rate limits and media upload support
- Thread publishing supported with partial-failure recovery

## Monitoring

Check structured logs for:
- `publishing.scheduled_jobs_enqueued` — scheduler activity
- `publishing.jobs_failed` — failed publishes
- `analytics.completed_syncs` — successful analytics runs
- `analytics.reconnect_required` — token issues

## Common issues

| Symptom | Likely cause | Action |
|---------|-------------|--------|
| Connect button does nothing | Mock adapters in bootstrap | Replace with production adapters |
| PERMISSION_MISSING status | User denied scopes | Reconnect and grant all permissions |
| Publishing fails with token error | Expired refresh token | Reconnect account |
| Capability blocked at scheduler | Scope not granted | Reconnect; verify app permissions |
| TikTok manual fallback | App not approved | Use manual publish with URL confirmation |
| Analytics shows no data | Sync not running or no READ_INSIGHTS | Check scheduler cron and capabilities |

## Related runbooks

- `docs/PUBLISHING_INCIDENT_RUNBOOK.md`
- `docs/CONNECTOR_RECOVERY_RUNBOOK.md`
- `docs/VIDEO_RENDERING_RUNBOOK.md`
