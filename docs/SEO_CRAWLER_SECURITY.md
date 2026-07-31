# SEO Crawler Security

## SSRF Prevention

`src/lib/seo/ssrf-guard.ts` blocks:
- localhost and `.local` / `.internal` hostnames
- RFC1918 private ranges, link-local, CGNAT
- Cloud metadata IPs (169.254.169.254)
- Non-HTTP(S) protocols
- Sensitive ports (SSH, database, etc.)
- Hostnames outside `allowedDomains`

## Domain Verification

No crawl without verified domain ownership. Site status must be ACTIVE.

## Robots Compliance

- `respectRobotsTxt` enabled by default
- No user-agent rotation to bypass rules
- Blocked pages recorded in metrics

## Tenant Isolation

All queries scoped by `organisationId` + `brandId`. Cross-tenant access returns NOT_FOUND.

## Sensitive Data

- Verification tokens stored as SHA-256 hashes only
- Form field values not stored
- Raw HTML storage via `rawReference` extension point (not full HTML by default)

## Worker Auth

Worker endpoints require `PUBLISHING_WORKER_TOKEN`. Unset token disables endpoints.
