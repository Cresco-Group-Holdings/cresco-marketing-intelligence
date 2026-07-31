# Stage 4 Release Checklist

## Pre-release

- [ ] All Stage 4 migrations applied to staging
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Unit and integration tests pass
- [ ] Production build succeeds (`npm run build`)
- [ ] `SEO_ENGINE_EMERGENCY_SHUTDOWN` documented in runbooks
- [ ] `SEO_AI_EMERGENCY_SHUTDOWN` documented in runbooks
- [ ] Worker token (`PUBLISHING_WORKER_TOKEN`) configured
- [ ] GSC connector credentials configured per environment
- [ ] AI provider credentials and cost limits verified

## Security

- [ ] SSRF tests pass (`tests/unit/seo-ssrf-guard.test.ts`, `stage-4-seo-production.test.ts`)
- [ ] Tenant isolation verified in services
- [ ] Worker auth returns 403 without token
- [ ] Custom header allowlist enforced
- [ ] Prompt injection detection active
- [ ] No auto-publish code paths in SEO services

## Functional validation (E2E scenario)

- [ ] Create SEO site → verify domain → configure crawl → complete crawl
- [ ] Import GSC keywords → group keywords
- [ ] Add competitor → identify content gap → create topic cluster
- [ ] Generate SEO brief → review → approve
- [ ] Generate long-form draft → flag unsupported claim
- [ ] Run on-page audit → build internal link graph → review recommendations
- [ ] Track keyword → detect decline → generate refresh recommendation
- [ ] Verify no automatic publishing
- [ ] Verify cross-tenant access denied

## Observability

- [ ] `/api/readiness` includes `seo_engine` check
- [ ] `/api/seo/metrics` returns crawl counters (requires `seoRawData.view`)
- [ ] AI usage visible at `/api/ai/usage`

## Documentation

- [ ] `STAGE_4_PRODUCTION_READINESS.md` reviewed
- [ ] `STAGE_4_KNOWN_LIMITATIONS.md` communicated to users
- [ ] Runbooks accessible to operations team

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Engineering | | | |
| Security | | | |
| Product | | | |
