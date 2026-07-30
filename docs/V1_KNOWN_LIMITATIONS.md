# V1 Known Limitations

Honest inventory of restrictions, disabled features, and engineering debt for V1 beta.

## Release gates (engineering debt)

| Limitation | Impact | Target |
|------------|--------|--------|
| Typecheck failures (49 errors) | CI gate blocked; mostly Prisma Json types and Stage 6 services | Pre-unrestricted production |
| Production build failure | Deployment blocked until lifecycle handler exports fixed | Immediate |
| Duplicate permission keys in `permissions.ts` | Typecheck error; potential RBAC ambiguity | Immediate |
| E2E V1 scenario not automated | Manual sign-off required for release | Post-V1 |

## Billing and quotas

| Limitation | Impact | Workaround |
|------------|--------|------------|
| Plan-tier enforcement partial | Only email daily quotas enforced | Manual tenant configuration |
| SEO crawl quotas not tied to billing | Per-org limits exist but not plan-linked | `resolveOrgQuota` manual override |
| Advertising spend limits | Organisation hard limits work; not plan-tier | Configure `AdvertisingBudgetPolicy` |
| Rank tracking keyword quota | Per-project limit; not plan-tier | Manual quota assignment |
| AI cost limits | Platform-wide; not per-plan | Monitor `/api/ai/usage` |

## Provider limitations

### Advertising (Stage 5)

| Limitation | Impact |
|------------|--------|
| Google: Search campaigns only | No Display, PMax, Video, Shopping |
| Meta: App review for non-owned accounts | Cannot launch on client accounts without review |
| LinkedIn: Document/matched audiences disabled | Planning only |
| TikTok: Spark Ads and sandbox disabled | Standard video ads only |
| Audience external activation | Audiences planned but not uploaded |
| Live policy review polling | Manual check in provider UI |
| Provider-side emergency pause | Platform blocks mutations only |
| Cross-currency FX for pacing | Missing rates excluded from totals |

Reference: `docs/STAGE_5_KNOWN_LIMITATIONS.md`

### Email (Stage 6)

| Limitation | Impact |
|------------|--------|
| Multi-provider per tenant | Supported but requires manual setup per provider |
| Custom SMTP webhooks | Manual suppression sync |
| Deliverability warm-up | Manual reputation management |
| Visual email builder | Not implemented; template-based only |

### SEO (Stage 4)

| Limitation | Impact |
|------------|--------|
| No JavaScript rendering | SPA content not fully crawled |
| DNS rebinding protection partial | Verified domains only in beta |
| Distributed crawl scaling | Postgres queue; in-memory rate limits |
| Plan-tier quota enforcement | Not tied to billing |

Reference: `docs/STAGE_4_KNOWN_LIMITATIONS.md`

### Analytics (Stage 3)

| Limitation | Impact |
|------------|--------|
| GSC 2–3 day delay | Stale search data |
| GA4 metric differences | Reconciliation documented, not identical |
| No cross-currency normalisation | Mixed-currency warnings only |
| Seasonal anomaly detection | Extension point only |
| Email metrics not in attribution | Use campaign analytics directly |

Reference: `docs/STAGE_3_KNOWN_LIMITATIONS.md`

## CRM and revenue ops (Stage 6)

| Limitation | Impact | Workaround |
|------------|--------|------------|
| MarketingLead ↔ CrmLead bridge | Separate inboxes; no auto-sync | Manual bridge field |
| Consent withdrawal automation | `withdrawnAt` not auto-processed | Manual suppression |
| Suppressed leads in export | Export minimisation deferred | Manual review before export |
| Company/contact import | Leads only in 6.1 | Contacts/companies post-V1 |
| Follow-up rules billing integration | `PAYMENT_FAILED` is extension point | Manual follow-up |
| Website/social auto-capture | Not wired to CRM | Manual lead creation |
| Hard deletion / DSR automation | Soft archive only; manual DSR | See `V1_PRIVACY_REVIEW.md` |
| Retention scheduler | Not implemented | Manual quarterly review |

## AI limitations

| Limitation | Impact |
|------------|--------|
| Prompt injection detection regex-based | May miss sophisticated attacks |
| Lifecycle agent stale data warning | >48h CRM data triggers warning |
| Lead scoring AI | Explains only; cannot modify scores |
| SEO AI claim review | Not fact-checked against live web |
| Advertising optimisation | Rule-based analysis; not live LLM in all paths |

## Disabled features (not in V1)

| Feature | Status |
|---------|--------|
| Autonomous email send | Disabled by design |
| Autonomous campaign launch | Disabled by design |
| Autonomous advertising spend increase | Disabled by design |
| Autonomous social publish | Disabled by design |
| Autonomous CRM stage/deal changes | Disabled by design |
| Audience upload to ad providers | Deferred |
| Spark Ads, Document Ads, PMax | Not verified |
| Multi-step visual email builder | Not implemented |
| Automated DSR workflow | Not implemented |
| MarketingLead bulk migration to CRM | Not implemented |
| Real-time collaborative editing | Not implemented |

## Operational requirements

- Manual provider account setup and OAuth connection
- Human approval for all launches, campaigns, and material AI actions
- Weekly advertising spend reconciliation
- Email domain verification before production sends
- Lead scoring simulation before model activation
- OWNER/ADMIN for emergency controls and organisation policy changes

## Beta spending and send limits

| Domain | Recommended limit |
|--------|-------------------|
| Advertising daily spend | Organisation hard limit (default 50% cap) |
| Email daily send | Tenant quota (configured per organisation) |
| SEO concurrent crawls | 3 per organisation |
| AI requests | Platform cost limits + tenant rate limiter |

## Path to unrestricted production

1. Fix all 49 typecheck errors
2. Verify production build
3. Implement automated E2E V1 scenario
4. Expand billing plan enforcement
5. Implement DSR workflow and retention scheduler
6. Complete Meta app review for client accounts
7. Resolve duplicate permission keys

See `docs/V1_POST_LAUNCH_BACKLOG.md` for prioritised engineering items.
