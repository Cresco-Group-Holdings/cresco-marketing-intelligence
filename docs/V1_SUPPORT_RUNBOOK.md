# V1 Support Runbook

Customer support procedures for V1 beta tenants.

## Support scope

V1 beta support covers:

- Cresco internal users
- Grants Intelligence and Capital Cresco Terminal brands
- Approved external pilot organisations (signed beta agreement)

Support is **best-effort** during beta. No formal SLA.

## Severity classification

| Tier | Description | Response target |
|------|-------------|-----------------|
| P1 — Critical | Cannot access platform; data breach suspected; emails sending to suppressed contacts | 1 hour |
| P2 — High | Major feature broken (CRM, email, forms); incorrect data affecting decisions | 4 hours |
| P3 — Medium | Feature degraded; workaround available | 1 business day |
| P4 — Low | How-to questions; feature requests | 2 business days |

Escalate P1/P2 to engineering immediately per `V1_INCIDENT_RESPONSE.md`.

## Common issues and resolutions

### Authentication

| Issue | Resolution |
|-------|------------|
| Cannot log in | Verify Supabase status; check email confirmation; reset password |
| OAuth callback error | Verify `APP_URL` matches OAuth redirect URI in provider console |
| Session expired | Clear cookies; re-login |
| Invitation link expired | Admin resends invitation from Settings → Members |

### CRM

| Issue | Resolution |
|-------|------------|
| Cannot see contact email/phone | User needs `crm.viewSensitiveContact` permission |
| Duplicate leads | Use duplicate management UI; deterministic merge only |
| Lead not created from form | Check form status (ACTIVE), origin allowlist, quarantine queue |
| Import failed | Review rejected rows in import job; check CSV format and field mapping |
| Opportunity stage won't change | Verify pipeline version is active; check stage transition rules |

### Forms

| Issue | Resolution |
|-------|------------|
| Submission rejected | Check origin allowlist, rate limits (20/min), payload size (64KB) |
| Submission quarantined | Review quarantine reason (honeypot, bot signals); manual release if legitimate |
| Consent error | Verify required consent blocks have correct wording version |
| Redirect not working | Check redirect URL against form allowlist |

### Email

| Issue | Resolution |
|-------|------------|
| Email not sending | Check domain verification (SPF/DKIM/DMARC); tenant quota; campaign approval status |
| High bounce rate | Review list quality; check suppression list; verify sender reputation |
| Recipient not receiving | Check suppression list; verify not unsubscribed; check spam folder |
| Campaign stuck in draft | Complete approval workflow; verify `emailCampaigns.launch` permission |
| Unsubscribe not working | Verify unsubscribe link in template; check webhook processing |

### Automation

| Issue | Resolution |
|-------|------------|
| Lead not enrolling | Check `consentMarketing: true`; verify not suppressed; automation must be ACTIVE |
| Journey stuck | Review enrollment step errors; check frequency limits |
| Email not sent in journey | Verify consent exit rules; check suppression; review action errors |
| Cannot activate journey | Graph validation failed (cycle, depth, or bounds); review error messages |

### Lead scoring

| Issue | Resolution |
|-------|------------|
| Score seems wrong | Review score breakdown evidence; check active model version |
| Model won't activate | Run safety checklist; verify simulation results; check prohibited attributes |
| Qualification status unexpected | Review threshold configuration; check for manual override |

### Lifecycle agent

| Issue | Resolution |
|-------|------------|
| Run blocked | Check for prompt injection, PII in notes, or LOW data confidence |
| Recommendation seems wrong | Review evidence package; check data freshness warnings |
| Cannot approve action | User needs `lifecycleAgent.approve` permission |
| Draft message concerns | Drafts are never auto-sent; user reviews before any send |

### Analytics

| Issue | Resolution |
|-------|------------|
| KPI shows Unavailable | Expected when data source not connected; not a bug |
| Stale data | Trigger manual sync; GSC has 2–3 day delay |
| Revenue not showing | Verify Stripe connected; check `brand_id` in Stripe metadata |
| Attribution seems wrong | Review model selection; check attribution window settings |

### Advertising

| Issue | Resolution |
|-------|------------|
| Cannot launch campaign | Complete 8 approval gates; verify provider OAuth; check app review status (Meta) |
| Spend alert | Review budget dashboard; trigger emergency pause if needed |
| Provider connection failed | Reconnect OAuth; check token expiry |
| Feature greyed out | Check provider capability matrix; may be disabled/unverified |

### SEO

| Issue | Resolution |
|-------|------------|
| Crawl not starting | Verify domain verification; check org crawl quota |
| Rank data missing | GSC delay; verify licensed data source configured |
| AI brief seems inaccurate | Review evidence drawer; briefs are proposals not facts |

## Data subject requests (DSR)

During V1 beta, DSR requests are handled **manually**:

1. Log request in support ticket with tenant ID and requester identity
2. Escalate to engineering + legal
3. Follow manual procedure in `V1_PRIVACY_REVIEW.md`
4. Target response: 30 days (adjust per jurisdiction)
5. Document completion in audit log

## Permission requests

| Request | Minimum approver |
|---------|-----------------|
| VIEWER → MARKETER | ADMIN |
| MARKETER → ADMIN | OWNER |
| Sensitive contact access | ADMIN |
| Email domain setup | ADMIN |
| Provider connection | ADMIN |
| Emergency controls | OWNER |

## Information to collect from users

- Organisation name and ID
- Brand name and ID
- User email and role
- Steps to reproduce
- Screenshots (redact PII)
- Approximate time of issue
- `x-request-id` from API error (if available)

**Never ask users to share passwords, API keys, or OAuth tokens.**

## Escalation to engineering

Escalate when:

- Cross-tenant data suspected
- Suppression bypass suspected
- Autonomous action occurred (should never happen)
- Data loss or corruption
- P1/P2 issues not resolved within target
- Recurring issue affecting multiple tenants

Include: ticket ID, tenant context, reproduction steps, relevant audit log IDs, request IDs.

## Beta limitation communication

When users request unavailable features, reference `V1_KNOWN_LIMITATIONS.md`:

- "This feature is planned for post-V1 — see known limitations doc"
- "Meta app review required for client ad accounts"
- "DSR requests handled manually during beta"
- "Billing plan limits not fully enforced — contact admin for quota adjustment"

## Related documents

- `docs/V1_BETA_SCOPE.md`
- `docs/V1_KNOWN_LIMITATIONS.md`
- `docs/V1_PRIVACY_REVIEW.md`
- `docs/RBAC.md`
- `docs/CRM_PERMISSIONS.md`
