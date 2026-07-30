# Stage 5 Release Checklist

## Pre-release

- [x] All Stage 5 migrations applied to staging
- [x] `npm run lint` passes
- [x] `npm run typecheck` passes
- [x] Unit tests pass (advertising + stage-5 production)
- [x] Production build succeeds (`NODE_OPTIONS=--max-old-space-size=8192 npm run build`)
- [x] `ADVERTISING_EMERGENCY_SHUTDOWN` documented in runbooks
- [x] Provider OAuth credentials configured per environment
- [x] AI provider credentials and cost limits verified

## Security

- [x] Tenant isolation verified in advertising services
- [x] Prompt injection detection active in optimisation agent
- [x] No auto-launch or auto-publish code paths
- [x] Mutation plan hash binding verified
- [x] Stale approval invalidation verified
- [x] Budget autonomous increase blocked
- [x] LLM direct mutation blocked

## Functional validation (E2E scenario)

- [x] Campaign plan creation with versioning (lib + service)
- [x] Objective selection and readiness gates
- [x] Audience creation with consent checks
- [x] Creative generation with compliance scan
- [x] Budget approval workflow
- [x] Provider draft generation (Google, Meta, LinkedIn, TikTok)
- [x] Mutation plan validation and hashing
- [x] Launch approval gates (8 types)
- [x] Experiment creation and validity checks
- [x] Budget pacing calculation
- [x] Optimisation recommendation with evidence
- [x] Controlled action request (no auto-apply)
- [x] Emergency pause blocks mutations
- [x] Cross-tenant access denied (service scoping)
- [ ] Live provider sandbox launch (manual — requires credentials)

## Observability

- [x] `/api/readiness` includes `advertising_platform` check
- [x] `/api/advertising/metrics` returns advertising counters
- [x] Audit events for emergency controls

## Documentation

- [x] `STAGE_5_PRODUCTION_READINESS.md` reviewed
- [x] `STAGE_5_KNOWN_LIMITATIONS.md` communicated
- [x] Runbooks accessible

## Sign-off

| Role | Decision |
|------|----------|
| Engineering | READY WITH RESTRICTIONS |
| Security | No critical findings |
| Operations | Manual provider procedures documented |
