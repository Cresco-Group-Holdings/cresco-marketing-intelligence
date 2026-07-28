# Provider Configuration

Configure OAuth credentials per environment. Never commit secrets to source control.

## Environment Variables

| Provider | Variables | Console |
|----------|-----------|---------|
| Instagram / Facebook | `META_APP_ID`, `META_APP_SECRET` | [Meta Developers](https://developers.facebook.com/) |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | [LinkedIn Developers](https://www.linkedin.com/developers/) |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | [TikTok Developers](https://developers.tiktok.com/) |
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | [X Developer Portal](https://developer.x.com/) |

Also required:

- `APP_URL` — canonical application URL
- `ENCRYPTION_KEY` — min 32 characters, unique per environment

## OAuth Redirect URLs

Register in each provider console:

| Environment | Redirect URL |
|-------------|--------------|
| Development | `http://localhost:3000/api/social/oauth/callback` |
| Preview | `https://<preview-domain>/api/social/oauth/callback` |
| Production | `https://<production-domain>/api/social/oauth/callback` |

## Isolation

Use separate provider apps (or documented isolation) per environment:

- Separate databases
- Separate `ENCRYPTION_KEY` per environment
- Separate OAuth redirect URLs
- Never share production credentials with preview/dev

## Provider Maturity

| Provider | Default Maturity | Notes |
|----------|-----------------|-------|
| Instagram | Available | Requires Meta app with Instagram Graph permissions |
| Facebook | Available | Shares Meta app credentials |
| LinkedIn | Available | Organisation pages require Marketing Developer Platform |
| TikTok | Beta | Business API access may require approval |
| YouTube | Available | Uses Google OAuth with YouTube scopes |
| X | Beta | API access tier dependent |

## Verification

1. Set env vars in Vercel/hosting dashboard
2. Deploy preview
3. Visit `/social/connections`
4. Provider should show "Available" or "Beta" (not "Not configured")
5. Complete OAuth flow and assign account

## Mock Adapters (Development/Tests)

When `registerAllMockSocialAdapters()` is called (via `ensureSocialAdaptersRegistered()`), mock adapters simulate OAuth without real provider credentials. Tests use mocked adapters exclusively.

Production deployments should replace mock adapters with real provider implementations as they become available.
