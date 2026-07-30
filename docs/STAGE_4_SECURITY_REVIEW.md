# Stage 4 Security Review

Security audit of the AI SEO Engine (Tasks 4.1–4.9).

## Summary

No critical vulnerabilities identified. SSRF, tenant isolation, AI injection controls, and publishing prohibition are implemented. Medium-risk gaps documented with mitigations.

## Controls verified

| Threat | Status | Implementation |
|--------|--------|----------------|
| SSRF | Mitigated | `src/lib/seo/ssrf-guard.ts` — hostname allowlist, private IP block, port block |
| DNS rebinding | Partial | Hostname validation only; no post-resolve IP check (see limitations) |
| Private network access | Mitigated | RFC1918, loopback, link-local, metadata IPs blocked |
| Cloud metadata access | Mitigated | `169.254.169.254`, `metadata.google.internal` blocked |
| Redirect-based SSRF | Mitigated | Each redirect hop re-validated in `safeFetch` |
| Malicious HTML | Mitigated | Size limits (2 MiB), regex parser, no script execution |
| Oversized pages | Mitigated | `maxContentBytes` enforced; `oversized_pages` counter |
| Decompression bombs | Mitigated | `maxSitemapDecompressedBytes` (50 MiB) |
| Unsafe structured data | Mitigated | JSON-LD parsed as text; no eval |
| Stored XSS | Mitigated | React escaping; no `dangerouslySetInnerHTML` in SEO UI |
| Cross-tenant page IDs | Mitigated | All queries scoped `organisationId` + `brandId`; NOT_FOUND on mismatch |
| Crawl abuse | Mitigated | Per-org concurrent/daily quotas; emergency shutdown flag |
| Competitor crawl bounds | Mitigated | 50 pages, depth 3, rate limits (`competitors/constants.ts`) |
| Arbitrary headers | Mitigated | `sanitiseCrawlCustomHeaders()` allowlist (Accept, Accept-Language, etc.) |
| Secrets in crawl logs | Mitigated | Structured logging; no raw auth headers logged |
| Raw HTML access | Gated | `seoRawData.view` permission required |
| CSV injection | Mitigated | Formula-prefix sanitisation in export paths |
| Prompt injection | Mitigated | `detectPromptInjection()`, input sanitisation, crawled content as untrusted |
| Competitor content | Mitigated | Excerpt truncation, plagiarism pattern checks |
| AI data leakage | Mitigated | Redaction, digest-only storage, tenant-scoped usage records |

## SSRF test coverage

- `tests/unit/seo-ssrf-guard.test.ts`
- `tests/unit/stage-4-seo-production.test.ts` — localhost, private IPs, metadata

## Tenant isolation

- API: `withApiHandler` + `buildTenantContext` + RBAC permissions
- Services: `brandService.getById()` before all mutations
- Worker routes: `PUBLISHING_WORKER_TOKEN` bearer auth only

## Recommendations

1. Set `SEO_ENGINE_EMERGENCY_SHUTDOWN=true` to disable crawls during incidents
2. Set `SEO_AI_EMERGENCY_SHUTDOWN=true` to disable SEO AI generation
3. Enable WAF rate limiting on crawl/competitor API endpoints
4. Add DNS rebinding guard (resolve + validate IP before connect) in v2
5. Monitor `ssrf_attempts` and `crawl_failures` via `/api/seo/metrics`

## Unresolved (non-critical)

| Item | Risk | Mitigation |
|------|------|------------|
| DNS rebinding | Medium | Domain allowlist reduces attack surface; add resolve-time check |
| Competitor robots fallback | Low | Proceeds without robots if fetch fails; bounded page count |
| In-memory rate limiters | Low | Acceptable for beta; Redis for scale |
