# Account recovery

Cresco supports self-service password recovery through Supabase Auth email flows.

## Forgot password

1. User visits `/forgot-password`
2. User submits their email address
3. The application calls `resetPasswordForEmail()` with a callback to `/auth/callback?redirect=/reset-password`
4. Supabase emails a secure recovery link
5. The API always returns the same success message, regardless of whether the email exists

## Reset password

1. User opens the recovery link in the same browser
2. `/auth/callback` exchanges the recovery code for a session
3. User is redirected to `/reset-password`
4. User submits a new password that satisfies the password policy
5. `/api/auth/reset-password` updates the password and redirects to `/login?reset=success`

## Password policy

Passwords must:

- be at least 12 characters
- include lowercase and uppercase letters
- include at least one number

## Email verification

New email/password accounts may require verification before full access.

- After signup, users are directed to `/verify-email`
- Verification links complete through `/auth/callback`
- Users can request another verification email from `/verify-email`

## Account enumeration protection

Login, signup, forgot-password, and verification resend endpoints return generic responses. The application does not reveal whether an email address is registered.

## Audit events

| Action | Event |
| --- | --- |
| Reset requested | `auth.passwordResetRequested` |
| Password changed | `auth.passwordChanged` |
| Email verified | `auth.emailVerified` |

Passwords, reset URLs, tokens, and cookies are never written to audit logs.

## Support escalation

If a user cannot access their account:

1. Confirm they are using the latest recovery email
2. Check spam filters and link expiry
3. Ask an organisation administrator to verify membership status
4. For suspended memberships, direct the user to their workspace administrator

OAuth-only accounts should use the original provider to sign in or connect an additional provider from `/settings/security`.
