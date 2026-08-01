# Resend Provider — Known Limitations (Task 7.2)

> Last reviewed: **2026-08-01**.
>
> Documented limitations of the Resend provider integration and upstream Resend platform constraints.

## Summary

| Category | Limitation | Workaround |
|----------|-----------|------------|
| Batch sending | Sequential single sends, not native batch API | Use queue; plan native batch migration |
| Attachments | Not supported in adapter | Send without attachments or use alternative channel |
| Templates | Not supported in adapter | Inline HTML/text in send request |
| Scheduling | Not supported | External scheduler triggers send at desired time |
| Inbound email | Not supported | Use Resend receiving separately |
| Webhook registration | Manual in Resend dashboard | Document per-tenant setup |
| Domain management | Read-only (list/status) | Configure DNS in Resend dashboard |
| API key revocation | Local only on disconnect | Manually delete key in Resend |
| Contact/broadcast APIs | Not integrated | Use Resend dashboard for marketing broadcasts |

---

## Platform limitations (Resend)

These are constraints from the Resend API/platform, not Cresco implementation gaps.

### Rate limits

| Limit | Value | Impact |
|-------|-------|--------|
| API requests | 10 req/s per team (default) | Batch adapter issues N calls for N messages |
| Email daily quota | Plan-dependent (free tier limited) | `429 daily_quota_exceeded` |
| Email monthly quota | Plan-dependent | `429 monthly_quota_exceeded` |
| Contact quota | Plan-dependent | Blocks broadcasts, not transactional |

Rate limit increases require contacting Resend support.

### Send limits

| Limit | Value |
|-------|-------|
| Recipients per email (`to` + `cc` + `bcc`) | 50 |
| Emails per batch request | 100 |
| Attachment size | 40 MB (after Base64 encoding) |
| Idempotency key length | 256 characters |
| Idempotency key TTL | 24 hours |
| Tag name/value length | 256 characters each |

### Authentication

| Limitation | Detail |
|------------|--------|
| API key visibility | Shown once at creation; cannot be retrieved |
| Permission types | Only `full_access` and `sending_access` |
| No OAuth | API key only (no token refresh flow) |
| User-Agent required | Missing header returns `403` error `1010` |

### Domain & deliverability

| Limitation | Detail |
|------------|--------|
| No shared sending domain | Must verify own domain (except `resend.dev` sandbox) |
| DKIM key size | 1024-bit only (no 2048-bit) |
| DMARC not auto-provisioned | Tenant must add `_dmarc` TXT record manually |
| No dedicated IPs | Shared Resend IP pool |
| Open/click tracking | Disabled by default; configured per domain in Resend dashboard |
| Domain recheck | Verified domains rechecked periodically; DNS removal → `temporary_failure` → `failed` after 72h |

### Webhooks

| Limitation | Detail |
|------------|--------|
| At-least-once delivery | Duplicates possible; deduplicate on `svix-id` |
| No ordering guarantee | `email.opened` may arrive before `email.delivered` |
| Retry schedule | Fixed intervals (5s to 10h); no custom retry config |
| No webhook API in adapter | Endpoints created manually in Resend dashboard |
| Contact CSV import | No `contact.created` webhooks for bulk CSV import |

### API versioning

| Limitation | Detail |
|------------|--------|
| No API versioning | No version header; breaking changes possible |
| No pagination on send | Single-request send only |

### Marketing features

| Feature | Status in Resend | Status in Cresco |
|---------|-----------------|------------------|
| Contacts | Available | Not integrated |
| Segments | Available | Not integrated |
| Broadcasts | Available | Not integrated |
| Topics (opt-in/out) | Available | Not integrated |
| Templates (dashboard) | Available | Not integrated |

---

## Cresco implementation limitations

These are deliberate Task 7.2 scope boundaries or known gaps in the adapter.

### Batch send implementation

**Limitation:** `sendBatch` in the adapter calls `sendEmail` sequentially for each message instead of using `POST /emails/batch`.

**Impact:**

- Consumes one rate-limit slot per message (10 req/s cap bites sooner).
- No batch-level idempotency key support.
- Higher latency for large batches.

**Mitigation:** Queue sends with rate-aware worker; plan migration to native batch endpoint.

### No attachment support

**Limitation:** `EmailSendRequest` and the Resend adapter do not handle `attachments`.

**Impact:** Cannot send files, inline images, or PDFs through the adapter.

**Mitigation:** Link to externally hosted content in HTML body.

### No template support

**Limitation:** Resend template ID + variables not exposed in send API.

**Impact:** All content must be inline HTML/text. Cannot use Resend dashboard templates.

**Mitigation:** Render templates in Cresco before calling send.

### No scheduled sends

**Limitation:** `scheduled_at` parameter not passed to Resend.

**Impact:** Cannot schedule future delivery through the adapter.

**Mitigation:** Use Cresco job scheduler to trigger send at desired time.

### No inbound email

**Limitation:** `email.received` webhooks not processed.

**Impact:** Cannot handle reply-to workflows or inbound parsing.

**Mitigation:** Use Resend receiving separately or a different provider for inbound.

### Domain management is read-only

**Limitation:** Adapter only calls `GET /domains`. No create, update, or verify endpoints.

**Impact:** Domains must be added and DNS configured in Resend dashboard before connecting.

**Mitigation:** Document domain setup in [RESEND_SETUP_GUIDE.md](./RESEND_SETUP_GUIDE.md).

### Connection test requires domain list permission

**Limitation:** `validateApiKey` and `testConnection` call `GET /domains`.

**Impact:** `sending_access`-only keys without domain list permission will fail connection test, even if they can send email.

**Mitigation:** Use `full_access` for initial setup, then rotate to `sending_access`. Or accept connection with send-only validation (future improvement).

### No provider-side disconnect

**Limitation:** `revokeConnection` only soft-deletes local credentials. Does not call Resend to delete API keys or webhooks.

**Impact:** Orphaned keys/webhooks remain active in Resend until manually deleted.

**Mitigation:** Document manual cleanup in disconnect procedure.

### Suppression removal not synced

**Limitation:** `suppression.removed` webhooks map to `UNKNOWN` and do not remove `EmailSuppression` records.

**Impact:** Manually removed suppressions in Resend remain in Cresco until cleared locally.

**Mitigation:** Admin tool to clear suppression; future webhook handler.

### Single provider per send path

**Limitation:** `unified-email-provider-service.ts` is Resend-specific.

**Impact:** Cannot route sends to SendGrid/SES without code changes.

**Mitigation:** Task 7.3+ multi-provider routing.

### Provider definition disabled by default

**Limitation:** `enabled: false` in `PROVIDER_DEFINITIONS`; requires `RESEND_PROVIDER_ENABLED=true`.

**Impact:** Resend not available until both env flag and definition are enabled.

### Approval gate for live sends

**Limitation:** Non-test sends require `approvalId`.

**Impact:** Cannot send live email without an approved message/campaign record.

**Mitigation:** By design for governance; use `messageType: "TEST"` for testing.

### Webhook tenant resolution by signature

**Limitation:** Resend webhooks lack `account_id`; tenant resolved by trying all active webhook secrets.

**Impact:** O(n) signature verification per webhook where n = active Resend connections platform-wide.

**Mitigation:** Acceptable at low connection counts; optimize with connection-specific URLs if needed.

### Event ordering

**Limitation:** Status precedence rules may not reflect true delivery timeline when events arrive out of order.

**Impact:** UI may briefly show `OPENED` before `DELIVERED` until both events arrive.

**Mitigation:** Sort display by `occurredAt`; precedence prevents data corruption.

### Simulated sends do not exercise Resend

**Limitation:** When `PROVIDER_LIVE_CALLS_ENABLED=false`, sends return `SIMULATED` without provider contact.

**Impact:** Integration tests in CI do not validate real Resend behavior.

**Mitigation:** Run integration tests against Resend sandbox with live calls enabled in staging.

---

## Error scenarios without automatic recovery

| Scenario | Behavior | Manual action required |
|----------|----------|----------------------|
| `409 concurrent_idempotent_requests` | Send fails | Retry after brief delay |
| `409 invalid_idempotent_request` | Same key, different payload | Use new idempotency key |
| `403 daily_quota_exceeded` | All sends blocked 24h | Upgrade plan or wait |
| API key deleted in Resend | All sends fail 401/403 | Reconnect with new key |
| DNS records removed | Domain → `temporary_failure` | Restore DNS within 72h |
| Webhook secret mismatch | All webhooks rejected | Update secret in Cresco |

---

## Future improvements

| Priority | Improvement | Benefit |
|----------|------------|---------|
| High | Native `POST /emails/batch` | Rate limit efficiency |
| High | Attachment support | Rich email content |
| Medium | Webhook registration via API | Automated tenant onboarding |
| Medium | `suppression.removed` handler | Suppression list accuracy |
| Medium | `sending_access` validation without domain list | True least-privilege keys |
| Low | Template send support | Dashboard-managed templates |
| Low | Scheduled send support | Delayed delivery |
| Low | Inbound email (`email.received`) | Reply workflows |
| Low | Provider-side disconnect | Automated key/webhook cleanup |

---

## Related documentation

- [RESEND_CAPABILITY_AUDIT.md](./RESEND_CAPABILITY_AUDIT.md)
- [RESEND_SETUP_GUIDE.md](./RESEND_SETUP_GUIDE.md)
- [RESEND_OPERATIONS_RUNBOOK.md](./RESEND_OPERATIONS_RUNBOOK.md)
- [../EMAIL_PROVIDER_CAPABILITIES.md](../EMAIL_PROVIDER_CAPABILITIES.md)
