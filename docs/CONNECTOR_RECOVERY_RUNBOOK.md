# Connector Recovery Runbook

Procedures for recovering social connector connections after token failures, credential compromise, or encryption key rotation.

## Connection status reference

| Status | Meaning | User action |
|--------|---------|-------------|
| `CONNECTED` | Active, tokens valid | None |
| `REAUTH_REQUIRED` | Refresh token expired or revoked | Reconnect |
| `PERMISSION_MISSING` | Required scopes not granted | Reconnect and grant permissions |
| `ERROR` | Unrecoverable provider error | Reconnect or disconnect |
| `DISCONNECTED` | User disconnected | Reconnect to restore |

## Token refresh failure

### Symptoms
- Publishing fails with token errors
- Analytics sync logs `analytics.reconnect_required`
- Account `reconnectRequiredAt` timestamp set

### Recovery
1. User navigates to Settings → Social Connections
2. Clicks **Reconnect** on the affected connection
3. Completes OAuth flow granting all requested permissions
4. Verify capabilities restored in connection details
5. Retry failed publishing jobs or wait for next scheduler run

### Bulk recovery (operator)
1. Query accounts with `reconnectRequiredAt IS NOT NULL`
2. Notify affected organisation admins
3. Do not attempt to refresh tokens server-side without user consent (provider ToS)

## Credential compromise

If `ENCRYPTION_KEY` or provider client secret is suspected compromised:

### Immediate
1. Set `PUBLISHING_EMERGENCY_SHUTDOWN=true`
2. Rotate provider OAuth client secret in provider developer console
3. Update client secret in Vercel environment variables

### Credential invalidation
1. For each affected connection, set status to `REAUTH_REQUIRED`
2. Delete stored credentials: `socialCredentialService.deleteCredentials(connectionId)`
3. Notify tenants to reconnect all social accounts

### Encryption key rotation
1. Generate new `ENCRYPTION_KEY` (min 32 chars)
2. **Do not** change key without re-encryption plan — existing tokens become unreadable
3. Use `socialCredentialService.rotateStoredCredentials` per connection to re-encrypt with new key version
4. Update `ENCRYPTION_KEY` in environment after all credentials rotated
5. Verify `CredentialRotationEvent` audit records

See `docs/BACKUP_RECOVERY.md` for database restore if rotation fails mid-way.

## Provider app suspension

### Symptoms
- All connections for a provider fail simultaneously
- Provider API returns app-level errors (not per-account)

### Recovery
1. Set `PUBLISHING_DISABLE_<PROVIDER>=true`
2. Check provider developer console for app status/review
3. Resolve app review issues or policy violations
4. Once app restored, remove kill switch
5. Have affected users reconnect

## Account assignment issues

### Symptoms
- "Account not owned by this connection" errors
- Publishing fails with FORBIDDEN on author/page selection

### Recovery
1. Disconnect and reconnect the provider connection
2. Re-assign accounts via pending accounts flow
3. Verify `providerAccountId` matches selected author/page
4. Re-create any schedules pointing to the old account assignment

## Database recovery

If connector data is corrupted:

1. Stop all schedulers (`PUBLISHING_SCHEDULER_ENABLED=false`, `SOCIAL_ANALYTICS_SYNC_ENABLED=false`)
2. Restore from backup (see `docs/BACKUP_RECOVERY.md`)
3. Run `npm run db:migrate:deploy` to ensure schema current
4. All tenants must reconnect social accounts (tokens in backup may be stale)
5. Re-enable schedulers after validation

## Mock adapter recovery (development)

If testing with mock adapters (`src/lib/social/bootstrap.ts`):

1. Mock tokens do not expire — reconnect failures indicate code issues, not token issues
2. Reset bootstrap: `resetSocialBootstrapForTests()` in test context
3. For production recovery, mock adapters must be replaced with production registration

## Verification checklist

After recovery:
- [ ] Connection status is `CONNECTED`
- [ ] Capabilities include required publish/read permissions
- [ ] Test publish to a sandbox account succeeds
- [ ] Analytics sync completes for the account
- [ ] No `reconnectRequiredAt` timestamp set
- [ ] Audit log shows successful reconnect event

## Related

- `docs/SOCIAL_PROVIDER_RUNBOOK.md`
- `docs/PUBLISHING_INCIDENT_RUNBOOK.md`
- `docs/SOCIAL_OAUTH_SECURITY.md`
- `docs/BACKUP_RECOVERY.md`
