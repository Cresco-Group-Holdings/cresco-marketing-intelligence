# Email Domain Setup

## Verification requirements

A domain is marked `READY` only when:

1. SPF status is `PASS`
2. DKIM status is `PASS`
3. Provider verification succeeds (`providerVerified: true`)

DMARC is tracked but not required for initial readiness.

## DNS records

Each domain receives configuration instructions for:

- **SPF** — authorises the provider to send on behalf of the domain
- **DKIM** — cryptographic signing selector record
- **DMARC** — policy record at `_dmarc.{domain}`

## Custom return path

Optional `customReturnPath` for bounce handling via a subdomain (e.g. `bounce.mail.example.com`).

## Verification flow

1. `addDomain` — creates domain in `PENDING` status with DNS instructions
2. `checkDomain` — queries provider adapter and updates SPF/DKIM/DMARC status
3. Domain transitions to `READY` only when all required checks pass

## Sending status values

`PENDING`, `VERIFYING`, `READY`, `SUSPENDED`, `FAILED`

Domains in non-`READY` status cannot be used for new sender identities.
