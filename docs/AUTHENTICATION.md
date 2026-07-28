# Authentication

Cresco Marketing Intelligence uses **Supabase Auth** with the `@supabase/ssr` package. Sessions are stored in secure HttpOnly cookies and refreshed by middleware on each request.

## Supported methods

| Method | Status | Entry point |
| --- | --- | --- |
| Email and password signup | Production | `/signup` |
| Email and password login | Production | `/login` |
| Email verification | Production | `/verify-email` |
| Forgot password | Production | `/forgot-password` |
| Password reset | Production | `/reset-password` |
| Password change | Production | `/settings/security` |
| Google OAuth | Production | `/login`, `/signup`, `/settings/security` |
| Microsoft OAuth | Extension point only | Not enabled |

## Auth routes

| Route | Purpose |
| --- | --- |
| `/login` | Email/password and Google sign-in |
| `/signup` | Account registration |
| `/verify-email` | Verification instructions and resend |
| `/forgot-password` | Password reset request |
| `/reset-password` | Set a new password from a recovery session |
| `/auth/callback` | Server-side OAuth and email verification callback |
| `/auth/error` | Safe authentication error page |

## Authenticated account routes

| Route | Purpose |
| --- | --- |
| `/settings/account` | Display name, locale, timezone, avatar URL |
| `/settings/security` | Password change and connected providers |
| `/settings/sessions` | Current session details and global revocation |

## API endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/signup` | POST | Email/password signup |
| `/api/auth/logout` | POST | Sign out current or global session |
| `/api/auth/forgot-password` | POST | Request reset email |
| `/api/auth/reset-password` | POST | Complete password reset |
| `/api/auth/change-password` | POST | Change password with reauthentication |
| `/api/auth/verify-email/resend` | POST | Resend verification email |
| `/api/auth/oauth/google` | POST | Start Google OAuth |
| `/api/auth/providers` | GET | List enabled OAuth providers |
| `/api/auth/profile` | GET/PATCH | Read and update account profile |
| `/api/auth/session` | GET/DELETE | Inspect or revoke sessions |

## Profile provisioning

On first valid login or callback, `ensureUserProfile()` creates a `UserProfile` if one does not exist. Repeat logins only sync the email address and preserve user-edited profile fields.

Provisioning is idempotent and safe for repeated callback attempts.

## Post-auth redirect rules

1. Suspended-only membership → `/auth/error?code=membership_suspended`
2. No active organisation membership → `/onboarding`
3. Valid workspace membership → `/dashboard`

Internal `redirect` query parameters are validated before use. External URLs are rejected.

## Google OAuth

OAuth is initiated server-side and completed in `/auth/callback` using `exchangeCodeForSession()`. OAuth codes are never logged or exposed to client-side storage.

Configure Google as a provider in the Supabase project dashboard. The application uses Supabase-managed OAuth rather than the connector `GOOGLE_CLIENT_ID` variables.

## Microsoft OAuth extension point

`src/lib/auth/providers.ts` defines a disabled Microsoft (`azure`) provider entry. Enable it in a future task after Supabase provider configuration and UX copy are ready.

## Security controls

- Rate limiting on login, signup, reset, and OAuth actions
- Generic login and reset responses to reduce account enumeration
- Password policy validation (12+ chars, upper, lower, number)
- Same-origin checks on mutating auth API routes
- Reauthentication required before password changes
- Security audit events recorded in `SecurityAuditLog`

## Test authentication

For automated tests, set:

```bash
ALLOW_TEST_AUTH=true
TEST_AUTH_USER_ID=...
TEST_AUTH_EMAIL=test@example.com
```

This bypasses Supabase in middleware and API handlers while still exercising tenant and workspace flows.
