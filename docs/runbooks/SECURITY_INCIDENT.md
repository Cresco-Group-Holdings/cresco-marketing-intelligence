# Runbook — Security Incident

## Triggers
- Suspected credential leak
- Cross-tenant data exposure report
- Unauthorised access attempt spike

## Immediate actions
1. **Contain:** Rotate compromised secrets (Stripe, OAuth, worker tokens, `ENCRYPTION_KEY` if needed)
2. **Revoke:** Invalidate affected user sessions via Supabase admin
3. **Preserve:** Export relevant audit logs (`security-audit-service`)

## Investigation
- Review `SecurityAuditEvent` records
- Check webhook/OAuth logs (sanitised)
- Identify scope: which tenants, which data types

## Communication
- Notify affected customers per policy
- Do not disclose internals in customer-facing errors

## Follow-up
- Root cause analysis
- Add regression test
- Update `TASK_9_PRODUCTION_READINESS_REPORT.md` findings
