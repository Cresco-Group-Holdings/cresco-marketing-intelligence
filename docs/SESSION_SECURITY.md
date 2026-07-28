# Session security

Cresco Marketing Intelligence stores authentication state in **Supabase SSR cookies**, not in `localStorage` or `sessionStorage`.

## Cookie model

Supabase manages access and refresh tokens inside HttpOnly cookies via `@supabase/ssr`. The browser JavaScript API cannot read these tokens.

| Property | Behaviour |
| --- | --- |
| HttpOnly | Yes — tokens are not accessible to client scripts |
| SameSite | Managed by Supabase SSR defaults (`Lax` in most flows) |
| Secure | Enabled automatically for HTTPS production deployments |
| Storage location | Cookies only — never `localStorage` |

## Session refresh

`src/middleware.ts` creates a Supabase server client on each matched request and calls `auth.getUser()`. This refreshes expired sessions when a valid refresh token is present.

## Expired or invalid sessions

When a protected route is accessed without a valid user:

1. Middleware redirects to `/login`
2. The original internal path is preserved in `?redirect=`
3. External redirect targets are rejected

## Logout scopes

| Scope | Behaviour |
| --- | --- |
| `local` | Signs out the current browser session |
| `global` | Revokes all sessions for the account where supported |
| `others` | Revokes other sessions while keeping the current one |

The sessions settings page uses global revocation through the Supabase admin API plus local sign-out.

## Return URL preservation

Only internal relative paths are accepted as redirect targets. Auth routes and `/auth/*` paths are excluded to prevent redirect loops.

## Global session revocation

`/api/auth/session` `DELETE` uses the Supabase service role client to revoke all sessions for the authenticated user, then signs out locally and records a `auth.sessionRevoked` audit event.

## Production recommendations

- Serve the app only over HTTPS in production
- Keep `APP_URL` aligned with the deployed canonical origin
- Use separate Supabase projects or keys per environment where possible
- Back middleware/API rate limiting with a shared store such as Redis in later tasks

## What not to do

- Do not store access or refresh tokens in `localStorage`
- Do not log cookies, tokens, or OAuth codes
- Do not accept absolute or protocol-relative redirect URLs
