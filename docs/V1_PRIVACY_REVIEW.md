# V1 Privacy Review

Audit of consent, suppression, deletion, retention, and data-subject workflows across Stages 1–6.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Consent capture (forms) | ✅ Ready | Purpose-separated blocks with wording version audit trail |
| Marketing consent (CRM/automation) | ✅ Ready | `consentMarketing` gate on enrollment and send |
| Email suppression | ✅ Ready | Cannot bypass for marketing sends |
| Unsubscribe handling | ✅ Ready | Category-scoped; creates suppression entries |
| PII minimisation (AI) | ✅ Ready | Redaction, digests, no raw prompt storage by default |
| Sensitive contact permissions | ✅ Ready | `crm.viewSensitiveContact` |
| IP evidence (forms) | ✅ Ready | Hashed only (`clientIpHash`) |
| Hard deletion / DSR automation | ⚠️ Partial | Soft archive supported; automated DSR workflow deferred |
| Consent withdrawal automation | ⚠️ Partial | `withdrawnAt` field exists; not auto-processed |
| Retention scheduler | ⚠️ Partial | Documented policies; automated purge not implemented |

**No critical privacy violations identified. DSR and retention automation are the primary gaps for unrestricted production.**

## Consent

### Form consent (Stage 6.2)

| Purpose | Required? | Storage |
|---------|-----------|---------|
| SERVICE_REQUEST | When block present | `purpose`, `state`, `wordingVersion`, `formVersionId` |
| MARKETING_EMAIL | Optional | Same |
| MARKETING_PHONE | Optional | Same |
| PERSONALISED_MARKETING | Optional | Same |
| ADVERTISING_AUDIENCE | Optional | Same |
| PARTNER_COMMUNICATIONS | Optional | Same |

Separation rule: optional marketing consent cannot substitute for required service consent (`validateConsentSubmissions()`).

Reference: `docs/FORM_CONSENT.md`

### CRM and automation consent

| Check | When enforced |
|-------|---------------|
| `consentMarketing: true` | Automation enrollment |
| Suppression list clear | Before email send |
| Unsubscribe status | Before marketing send |
| Consent withdrawal exit rule | Before each messaging action in journey |

Reference: `docs/AUTOMATION_SAFETY.md`, `docs/EMAIL_SUPPRESSION.md`

### Advertising audience consent (Stage 5)

`AdvertisingAudienceConsentPolicy` defines consent requirements and retention limits. External audience upload deferred.

Reference: `docs/AUDIENCE_PRIVACY.md`

## Suppression

### Email suppression reasons

| Reason | Blocks marketing | Blocks transactional |
|--------|------------------|---------------------|
| UNSUBSCRIBE | Yes | No |
| HARD_BOUNCE | Yes | Yes |
| COMPLAINT | Yes | Yes |
| MANUAL | Yes | No* |
| LEGAL_DELETION | Yes | Yes |
| INVALID_ADDRESS | Yes | Yes |
| PROVIDER_SUPPRESSION | Yes | Varies |
| TENANT_BLOCK | Yes | Yes |

Enforcement: `queueMessage` and `shouldBlockSend` — marketing sends cannot bypass suppression.

Webhook processing auto-creates suppressions for bounces and complaints.

### Lead scoring negative signals

`SUPPRESSED`, `CONSENT_WITHDRAWN`, `EMAIL_UNSUBSCRIBED` are negative scoring signals that reduce outreach eligibility.

## Deletion

### Current capabilities

| Entity | Soft delete | Hard delete | Notes |
|--------|-------------|-------------|-------|
| CRM leads | `archivedAt` | Deferred | Merge archives source; preserves attribution |
| CRM opportunities | `archivedAt` | Deferred | Stage history retained |
| Form submissions | Status-based | Not auto-deleted | Quarantined submissions retained |
| AI requests | Digest only | N/A | No raw prompt retention by default |
| SEO crawl data | Site deletion | Per-site purge | `docs/SEO_DATA_PRIVACY.md` |
| Marketing assets | `archivedAt` | Storage versioning | Object storage lifecycle |

### DSR workflow (current state)

Automated data-subject request (DSR) workflow is **not fully implemented**. Manual procedure:

1. **Identify** — Locate tenant records by email/identifier across CRM, email suppression, form submissions, marketing leads.
2. **Suppress** — Add `LEGAL_DELETION` suppression; set `consentMarketing: false`.
3. **Archive** — Soft-archive CRM records (`archivedAt`).
4. **Export** — Provide data export via CRM import/export (field-minimised per permissions).
5. **Document** — Record request in audit log; retain deletion evidence per policy.
6. **Provider cleanup** — Manually request deletion from connected email/ad/social providers.

Post-V1: implement automated DSR ticket workflow with retention scheduler integration.

## Retention

See `docs/V1_DATA_RETENTION.md` for full policy. Summary:

| Data class | Default retention | Automated purge |
|------------|-------------------|-----------------|
| CRM records | Indefinite while active | No |
| Form submissions | Indefinite | No |
| Email events | Per tenant policy | No |
| AI usage digests | Billing audit period | No |
| SEO crawl pages | While site active | On site deletion |
| Audit logs | 12 months recommended | No |
| Quarantined spam | 90 days recommended | No |

## AI privacy

- `SensitiveDataRedactor` strips tokens, API keys, passwords before provider calls
- Raw OAuth tokens, session cookies, and DB credentials never sent to AI
- Diagnostics disabled in production unless `ALLOW_AI_DIAGNOSTICS=true`
- Lifecycle agent blocks PII in user notes from entering analysis pipeline

Reference: `docs/AI_PRIVACY.md`, `docs/LIFECYCLE_AGENT_SAFETY.md`

## Personal data classification (CRM)

| Data | Sensitivity | Control |
|------|-------------|---------|
| Email, phone | High | `crm.viewSensitiveContact` |
| Name, company | Standard | `crm.read` |
| Attribution/UTM | Standard | `crm.read` |
| Revenue links | High | `crm.viewRevenue` |

Reference: `docs/CRM_PERSONAL_DATA.md`

## Findings

| Severity | Finding | Mitigation |
|----------|---------|------------|
| Medium | No automated DSR workflow | Manual procedure documented; post-V1 backlog |
| Medium | Consent withdrawal not auto-processed | Manual suppression on withdrawal request |
| Low | Suppressed leads may appear in export | Export minimisation; manual review |
| Low | Retention scheduler not implemented | Documented policies; quarterly manual review |
| Info | Raw IP not stored on forms | Hashed only — compliant |

## No critical findings

Consent and suppression controls are enforced at send time. AI privacy controls align with Stage 1 baseline.
