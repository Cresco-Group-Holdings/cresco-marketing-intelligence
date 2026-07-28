# Security baseline

Task 1.1 establishes the initial security posture for Cresco Marketing Intelligence. Additional controls will be added as integrations and automation are implemented.

## Tenant isolation

- Authenticated data is scoped by `organisationId`.
- Project-owned records require `projectId` where appropriate.
- Membership is validated server-side before establishing tenant context.
- Repositories assert organisation and project scope before returning records.
- Client-supplied organisation identifiers are never trusted without membership checks.

## Secret management

Server-only secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- AI provider keys
- OAuth client secrets
- database credentials

Public client values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never expose server-only secrets through `NEXT_PUBLIC_*` variables, API responses, or client bundles.

## Logging restrictions

Structured logging redacts sensitive keys such as:

- passwords
- access and refresh tokens
- cookies
- API keys and OAuth secrets
- confidential prompt content

Do not log full authentication headers or session cookies.

## HTTP security controls

- secure response headers via middleware
- Content Security Policy baseline
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- HSTS for production deployments behind HTTPS

## Input and redirect safety

- Zod validates environment configuration
- API routes should validate request payloads before service calls
- redirect targets are restricted to safe internal paths

## Rate limiting

A reusable in-memory rate limit abstraction is available for sensitive endpoints. Production deployments should back this with a shared store such as Redis in later tasks.

## Audit events

`AuditLog` records provide the foundation for security-relevant actions. Future tasks will expand audit coverage for connector changes, role updates, and AI-assisted operations.

## OAuth token storage

OAuth access and refresh tokens are **not** implemented in Task 1.1. Future connector tasks will store tokens encrypted at rest using server-only credentials and tenant-scoped records.

## Dependency and secret scanning

- `npm run audit:deps` — dependency vulnerability audit
- `npm run audit:secrets` — repository secret pattern scan

Both run in pull request CI.

## Pending security work

The following assumptions remain open for later tasks:

- production WAF / edge rate limiting
- encrypted OAuth token storage
- full CSRF strategy for non-auth mutations
- secret rotation automation
- penetration testing and formal security review
- SOC2 / ISO control mapping

## Authentication flow

Supabase provides the primary authentication mechanism. The application uses secure HTTP-only session cookies via `@supabase/ssr`. Sign-out, MFA, and enterprise SSO policies will be expanded in later tasks.
