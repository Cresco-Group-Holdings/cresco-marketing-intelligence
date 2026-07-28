# Cresco Marketing Intelligence — Architecture

## Overview

Cresco Marketing Intelligence is a multi-tenant SaaS platform for planning, creating, publishing, measuring, and optimising marketing campaigns. Task 1.1 establishes the application foundation, tenant safety baseline, and dashboard shell without implementing operational integrations.

## Application layers

The codebase is organised into clear layers:

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/app`, `src/components` | Routing, layout, presentation, empty states |
| Features | `src/features` | Feature module boundaries and future domain entry points |
| API routes | `src/app/api` | HTTP transport, request validation, response envelopes |
| Domain services | `src/server/services` | Business workflows and audit orchestration |
| Repositories | `src/server/repositories` | Tenant-scoped database access |
| Libraries | `src/lib` | Auth, environment, tenancy, security, logging, errors |
| Types | `src/types` | Shared application types |

Business logic must not live directly inside React components or API route handlers. Route handlers should delegate to services and repositories.

## Feature module boundaries

Each feature directory is a future home for domain-specific UI, hooks, schemas, and service adapters:

- `authentication` — Supabase session handling and account flows
- `organisations` — organisation membership and roles
- `projects` — project scoping within organisations
- `brands` — brand profiles within projects
- `connectors` — external platform integrations
- `ai` — provider abstraction and governed AI workflows
- `analytics` — reporting and intelligence pipelines

Task 1.1 only defines these boundaries. Implementation arrives in later tasks.

## Tenant context

All authenticated application data is scoped by `organisationId`. Project-owned records are additionally scoped by `projectId`.

Tenant context is established server-side through:

- `requireAuthenticatedUser()`
- `requireOrganisationMembership()`
- `requireOrganisationRole()`
- `runWithTenantContext()` / `withTenantContext()`
- `getCurrentOrganisationContext()`

The browser must never be trusted to supply a valid organisation context. API routes and repositories validate membership before returning or mutating data.

## Authentication boundary

Supabase Auth handles identity. Application profiles and memberships live in PostgreSQL via Prisma.

Public routes are explicitly allowlisted. Middleware refreshes sessions and redirects unauthenticated users away from protected routes. Server-only credentials such as the Supabase service role key never reach the client.

## Future connector architecture

Connectors will follow this pattern:

1. OAuth configuration stored server-side
2. Tenant-scoped connector records (future task)
3. Sync jobs executed by background workers (future task)
4. Normalised connector status exposed through `/connectors`

Environment variables for Google, Meta, TikTok, and LinkedIn are already prepared but optional during local development.

## Future AI provider abstraction

AI providers will be routed through a server-only abstraction that:

- selects provider based on configuration and policy
- enforces organisation-level guardrails
- records audit events for AI-assisted actions
- never exposes provider API keys to the browser

Task 1.1 only prepares environment variables and feature placeholders.

## API response standard

All API routes should return the shared envelope defined in `src/lib/api/response.ts`:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}
```

Failures return safe user-facing messages with a `requestId` for support correlation.

## Request lifecycle

1. Middleware applies security headers and auth session checks.
2. API route creates a `requestId`.
3. Route validates input and establishes tenant context.
4. Service/repository performs tenant-scoped work.
5. Structured logs and audit events are recorded server-side.
6. Response envelope is returned without secrets or stack traces.
