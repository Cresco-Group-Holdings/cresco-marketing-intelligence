# SEO Site Verification

## Supported Methods

| Method | Description |
|--------|-------------|
| `DNS_TXT` | Add TXT record `cresco-verify=<token>` |
| `HTML_FILE` | Upload `cresco-verify-<token>.html` |
| `META_TAG` | Add `<meta name="cresco-site-verification" content="<token>" />` |
| `TRACKING_PROPERTY` | Domain already verified on linked TrackingProperty |
| `SEARCH_CONSOLE` | Connected GSC account for brand |

## Storage

Verification state on `SeoSiteDomain`:
- `verificationMethod`
- `verificationTokenHash` (never store raw token)
- `verificationStatus` (PENDING, VERIFIED, FAILED)
- `verifiedAt`, `verifiedByUserId`, `lastCheckedAt`

## Policy

- Crawling blocked until at least one domain is VERIFIED and site status is ACTIVE.
- No production-scale crawling of unverified third-party sites.
- Test environments may auto-verify via `ALLOW_TEST_AUTH=true` with META_TAG method.
