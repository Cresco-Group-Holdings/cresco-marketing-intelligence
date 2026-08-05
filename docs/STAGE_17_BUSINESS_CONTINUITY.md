# Stage 17: Business Continuity

## Recovery objectives

| Metric | Target | Notes |
|--------|--------|-------|
| RPO (Recovery Point Objective) | ≤ 24 hours | Managed database point-in-time recovery |
| RTO (Recovery Time Objective) | ≤ 4 hours | Full platform restore from backup |

## Backup schedule

- **Database**: Managed provider automated daily backups with PITR (see `docs/V1_BACKUP_RECOVERY.md`).
- **Object storage**: Supabase Storage bucket versioning recommended for marketing assets.
- **Configuration**: Environment variables stored in deployment platform secrets manager.

## Restore testing

- Quarterly restore drill documented in `docs/V1_BACKUP_RECOVERY.md`.
- Admin Centre retention tools (`/admin/retention`) support audit log purging post-restore validation.

## Rollback procedure

1. Identify the failing deployment via health/readiness checks.
2. Roll back application to previous Vercel/deployment revision.
3. If schema migration caused failure, apply down-migration or restore DB snapshot.
4. Verify `/api/readiness` returns `ready: true`.
5. Announce resolution via system announcements.

## Provider outage procedure

1. Circuit breakers in `provider-health-service` will mark connections unhealthy.
2. Operational alerts surface in `/operations` and Admin Centre failed jobs.
3. Enable emergency shutdown flags if needed: `EMAIL_EMERGENCY_SHUTDOWN`, `ADVERTISING_EMERGENCY_SHUTDOWN`, `SEO_ENGINE_EMERGENCY_SHUTDOWN`.

## Communication templates

### Maintenance window
> Scheduled maintenance on [DATE] from [START] to [END] UTC. Some features may be temporarily unavailable.

### Incident in progress
> We are investigating [ISSUE]. Updates will follow. Reference: [REQUEST_ID].

### Resolution
> The issue affecting [FEATURE] has been resolved. All systems are operational.

## Support access

Controlled impersonation is available via `/admin/support-access`:
- Requires platform admin grant or `PLATFORM_ADMIN_EMAILS` allowlist.
- Mandatory reason (min 10 characters).
- Auto-expires within 60 minutes (configurable up to 240).
- Full audit trail in `SecurityAuditLog`.
- User-visible support sessions can be listed and revoked.
