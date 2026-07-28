# Social Connections

## Overview

Social connections allow a brand to securely link Instagram, Facebook, LinkedIn, TikTok, YouTube, and X accounts via OAuth 2.0. Credentials are encrypted server-side and never exposed to the browser.

## Architecture

```
UI (/social/connections)
  → API routes (/api/brands/[brandId]/social/...)
    → socialConnectionService
      → socialOAuthService (OAuth lifecycle)
      → socialCredentialService (encryption)
      → SocialProviderAdapter (per provider)
```

## Data Models

| Model | Purpose |
|-------|---------|
| `SocialConnection` | OAuth connection per brand per provider |
| `SocialConnectionCredential` | Encrypted access/refresh tokens |
| `SocialAccount` | Selected account assigned to brand |
| `SocialAccountCapability` | Detected capabilities per account |
| `OAuthAuthorisationState` | Short-lived OAuth state with PKCE |
| `CredentialRotationEvent` | Encryption key rotation audit trail |

## Connection Flow

1. User selects provider on `/social/connections`
2. `POST .../social/connections/{provider}/connect` creates connection and returns `authorisationUrl`
3. User completes OAuth at provider
4. Provider redirects to `GET /api/social/oauth/callback`
5. Server exchanges code, encrypts tokens, fetches available accounts
6. User selects account (required when multiple accounts returned)
7. `POST .../connections/{connectionId}/assign-account` assigns account and detects capabilities
8. Connection status becomes `CONNECTED` (or `PERMISSION_MISSING` if scopes insufficient)

## API Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/brands/{brandId}/social/connections` | `socialConnections.read` |
| POST | `/api/brands/{brandId}/social/connections/{provider}/connect` | `socialConnections.create` |
| GET | `/api/brands/{brandId}/social/connections/{connectionId}/pending-accounts` | `socialConnections.read` |
| POST | `/api/brands/{brandId}/social/connections/{connectionId}/assign-account` | `socialAccounts.assign` |
| POST | `/api/brands/{brandId}/social/connections/{connectionId}/reconnect` | `socialConnections.reconnect` |
| POST | `/api/brands/{brandId}/social/connections/{connectionId}/disconnect` | `socialConnections.disconnect` |
| GET | `/api/social/oauth/callback` | Authenticated user |

## Connection Statuses

- `CONNECTING` — OAuth in progress
- `CONNECTED` — Account assigned, tokens valid
- `REAUTH_REQUIRED` — Token refresh failed
- `PERMISSION_MISSING` — Required scopes not granted
- `ERROR` — Connection failed
- `DISCONNECTED` — User disconnected; credentials deleted

## UI

- `/social` — Overview with link to connections
- `/social/connections` — Provider catalogue, connection management, account selection

Providers display maturity: Available, Beta, Not configured, Unavailable.

## Not Implemented (Later Tasks)

- Publishing posts
- Scheduling
- Analytics sync
- Comment/message management
