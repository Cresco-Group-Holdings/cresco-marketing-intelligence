# Ad OAuth Recovery

## Expired token

**Symptoms**: Provider API returns 401; connection shows disconnected

**Actions**:
1. Navigate to Settings → Connections
2. Click Reconnect for affected provider
3. Complete OAuth flow
4. Verify account listing works
5. Re-run draft validation before launch

## Revoked access

**Symptoms**: Provider returns permission denied

**Actions**:
1. Check user still has access in provider UI (Google MCC, Meta Business Manager)
2. Re-authorise OAuth with correct scopes
3. Verify developer token (Google) or app review status (Meta)

## Token refresh failure

**Actions**:
1. Check connector refresh logs
2. If persistent: disconnect and reconnect
3. Do not store or log token values

## Scope changes

If provider requires additional scopes:
1. Update OAuth configuration
2. Force re-consent for all connected accounts
3. Update capability gates if new features enabled

## Security incident

If token compromise suspected:
1. Revoke token in provider developer console
2. Disconnect in platform
3. Rotate app credentials
4. Audit recent mutations via audit log
5. Trigger `ORGANISATION_FREEZE` if unauthorised mutations detected
