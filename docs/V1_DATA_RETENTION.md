# V1 Data Retention

Data retention policies and purge procedures for V1 production.

## Policy principles

1. **Minimise** — Store only data required for product function and compliance.
2. **Tenant-scoped** — Retention applies per organisation/brand.
3. **Audit trail** — Deletion events are logged; consent evidence preserved until legally cleared.
4. **No silent purge** — Automated retention scheduler not yet implemented; manual review required.

## Retention schedule

| Data class | Default retention | Purge method | Automated |
|------------|-------------------|--------------|-----------|
| CRM leads & contacts | Active tenant lifetime | Soft archive (`archivedAt`); hard delete manual | No |
| CRM opportunities | Active tenant lifetime | Soft archive; stage history retained | No |
| Form submissions | Active tenant lifetime | Status-based; quarantined reviewed at 90 days | No |
| Form consent records | 7 years (recommended) | Retain for compliance; purge on legal clearance | No |
| Email messages & events | 24 months (recommended) | Manual purge per tenant | No |
| Email suppression list | Indefinite while suppressed | Remove only on explicit request + audit | No |
| Marketing automation enrollments | 12 months after completion | Manual archive | No |
| Lead scoring history | 24 months (recommended) | Manual purge | No |
| Lifecycle agent runs | 12 months (recommended) | Manual purge; evidence retained with run | No |
| AI request digests | 12 months (billing audit) | Automated post-V1 | No |
| Audit logs | 12 months (recommended) | Manual archive to cold storage | No |
| Security audit logs | 24 months (recommended) | Manual archive | No |
| Marketing warehouse events | 24 months (recommended) | Partition/archive post-V1 | No |
| SEO crawl pages | While site active | Deleted on site deletion | Partial |
| SEO competitor excerpts | 12 months (recommended) | Truncated at ingestion | N/A |
| Marketing assets | Active tenant lifetime | `archivedAt` soft delete; storage versioning | No |
| Connector credentials | Until disconnect | Deleted on disconnect flow | Yes |
| OAuth tokens | Until disconnect/revoke | Deleted on disconnect | Yes |
| Quarantined spam submissions | 90 days (recommended) | Manual review then delete | No |
| Invitation tokens | 7 days after expiry | Hashed; auto-expire | Yes |
| Session data | Managed by Supabase | Provider policy | Yes |

## Consent and legal holds

| Scenario | Retention rule |
|----------|---------------|
| Active marketing consent | Retain contact and consent evidence |
| Consent withdrawn | Retain withdrawal record; suppress outreach; do not delete evidence immediately |
| Legal hold / litigation | Suspend all purge for affected tenant |
| DSR erasure request | Manual procedure; see `V1_PRIVACY_REVIEW.md` |
| GDPR legal deletion suppression | `LEGAL_DELETION` reason blocks all sends |

## PII handling

| Data | Storage | Retention note |
|------|---------|---------------|
| Email, phone (CRM) | Encrypted at rest (DB); permission-gated | Purged on DSR |
| Form IP address | Hashed only (`clientIpHash`) | No raw IP stored |
| AI prompts | SHA-256 digest + 500-char redacted preview | No full prompt by default |
| Stripe payment data | Stripe-hosted (PCI) | Platform stores metadata only |
| Contact method verification | State tracked per method | Retained with contact record |

## Tenant offboarding

When a beta tenant leaves:

1. Export data per tenant request (field-minimised per permissions)
2. Revoke all connector OAuth tokens
3. Pause all automations and campaigns
4. Add organisation-level email suppression
5. Soft-archive all CRM records
6. Schedule hard delete after 30-day grace period (manual)
7. Delete object storage assets after grace period
8. Retain audit logs per compliance schedule
9. Document completion in audit log

## Backup retention

| Backup type | Retention | Reference |
|-------------|-----------|-----------|
| PostgreSQL daily | Per provider plan (min 7 days) | `V1_BACKUP_RECOVERY.md` |
| PostgreSQL PITR | Per provider plan | `V1_BACKUP_RECOVERY.md` |
| Object storage versions | Per bucket policy | `V1_BACKUP_RECOVERY.md` |

Backups may contain data that has been logically deleted from the application. Backup retention is independent of application retention.

## Post-V1 automation roadmap

| Item | Priority |
|------|----------|
| Retention scheduler service | High |
| Automated DSR workflow | High |
| Quarantined submission auto-purge (90 days) | Medium |
| AI digest auto-purge (12 months) | Medium |
| Warehouse event partitioning | Medium |
| Tenant offboarding automation | Medium |

See `docs/V1_POST_LAUNCH_BACKLOG.md`.

## Compliance notes

- Consent wording versions must be retained for audit (form submissions store `wordingVersion`)
- Email suppression records should not be deleted without legal review
- Advertising audience consent policies retained with audience definitions
- Merge operations preserve source attribution evidence (not silently deleted)

## Review schedule

| Review | Frequency | Owner |
|--------|-----------|-------|
| Retention policy compliance | Quarterly | Legal + Engineering |
| Quarantined submission purge | Monthly | Operations |
| Backup retention alignment | Quarterly | Infrastructure |
| Tenant offboarding audit | Per offboarding | Support + Engineering |
