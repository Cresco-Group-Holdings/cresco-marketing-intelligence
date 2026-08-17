# Meta / Instagram OAuth Setup

Configure Meta (Facebook) OAuth for production connections to Facebook Pages and Instagram Business accounts.

## Required environment variables

| Variable | Description |
|----------|-------------|
| `META_APP_ID` | Meta app ID from [Meta for Developers](https://developers.facebook.com/) |
| `META_APP_SECRET` | Meta app secret |
| `APP_URL` | Public application URL (used to resolve OAuth callback) |
| `ENCRYPTION_KEY` | 32-byte key for credential encryption at rest |
| `OAUTH_STATE_SIGNING_KEY` | Key for signing OAuth state payloads |

Optional (development only):

| Variable | Description |
|----------|-------------|
| `ALLOW_OAUTH_MOCK` | Set to `true` to use mock OAuth in non-test environments |
| `ALLOW_MOCK_SOCIAL_ADAPTERS` | Set to `true` for mock social publishing adapters |

## Callback URL

Register this redirect URI in your Meta app:

```
{APP_URL}/api/integrations/oauth/meta/callback
```

For Meta Ads connections (`meta-ads` provider key):

```
{APP_URL}/api/integrations/oauth/meta-ads/callback
```

## Scopes

Default scopes for `meta` include (see `provider-definitions.ts`):

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `instagram_basic`
- `instagram_content_publish`
- `business_management`

Adjust scopes in provider definitions only when product requirements change. Missing scopes after connect result in `ACTION_REQUIRED` status.

## Token lifecycle

Meta OAuth flow in Cresco:

1. Exchange authorization code for short-lived user access token.
2. Exchange short-lived token for long-lived token (~60 days).
3. Store long-lived token encrypted as both access and refresh credential.
4. Refresh via `fb_exchange_token` grant before expiry.

`tokenLifecycleService` refreshes tokens within 5 minutes of expiry.

## Account discovery

After connect, Cresco discovers:

- Facebook Pages (`meta_page`)
- Linked Instagram Business accounts (`meta_instagram_business`)
- Meta Business accounts for `meta-ads` (`meta_business`)

Users select accounts in the integrations UI before publishing or analytics use those accounts.

## Local development

1. Create a Meta app in Development mode.
2. Add test users and Instagram/Facebook test assets.
3. Set env vars in `.env.local`.
4. Run the app and open **Integrations → Meta**.
5. Click **Connect** and complete the Meta authorization screen.

For local testing without Meta credentials, set `ALLOW_OAUTH_MOCK=true` — mock connections are never used in production.

## Production configuration

1. Complete Meta app review for required permissions.
2. Switch app to Live mode.
3. Set `META_APP_ID`, `META_APP_SECRET`, and `APP_URL` in production secrets.
4. Verify `getProviderOAuthConfigDetail("meta")` returns `READY`.
5. Confirm integrations UI shows **Connect** (not "Not configured").

## Reconnect

Use **Reconnect** when:

- Token expired and refresh failed
- Required scopes were added
- Meta permissions were revoked externally

Reconnect preserves the connection ID and replaces stored credentials after successful OAuth.

## Revoke / disconnect

**Revoke** calls Meta `DELETE /me/permissions` then clears local encrypted credentials.

If remote revoke fails (network, already revoked), local credentials are still invalidated and the connection is marked `REVOKED`.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| "Not configured" in UI | `META_APP_ID` and `META_APP_SECRET` set |
| Redirect URI mismatch | Meta app callback matches `{APP_URL}/api/integrations/oauth/meta/callback` |
| `ACTION_REQUIRED` after connect | Reconnect and grant missing scopes |
| `REAUTH_REQUIRED` | User must reconnect; refresh token unavailable |
| Instagram account missing | Facebook Page must have linked Instagram Business account |

## Security notes

- Never log tokens, codes, or secrets.
- Tokens are only available server-side via `credentialVault` and `tokenLifecycleService`.
- OAuth state is signed and tenant-bound; tampered callbacks are rejected.
