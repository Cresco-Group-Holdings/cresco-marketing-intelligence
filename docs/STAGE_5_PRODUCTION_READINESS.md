# Stage 5 Production Readiness

Audit of Tasks 5.1–5.9 (AI Advertising Platform) before customer or production use.

## Release decision

**READY WITH RESTRICTIONS**

The AI Advertising Platform is production-viable for controlled beta with human-in-the-loop workflows, approved provider test accounts, and documented spending limits. Restrictions apply to live provider policy polling, audience activation, cross-currency FX, and provider-side emergency enforcement.

| Module | Task | Status | Notes |
|--------|------|--------|-------|
| Campaign planning | 5.1 | Ready | Versioned plans, readiness gates, approval workflow |
| Creative studio | 5.2 | Ready with restrictions | Client-side compliance; no auto-publish |
| Audience intelligence | 5.3 | Ready with restrictions | Planning only; external activation deferred |
| Google Ads management | 5.4 | Ready with restrictions | Search-only; paused launch; 8 approval gates |
| Meta Ads management | 5.5 | Ready with restrictions | App review required for non-owned accounts |
| LinkedIn Ads | 5.6 | Ready with restrictions | Document/matched audiences disabled |
| TikTok Ads | 5.6 | Ready with restrictions | Spark Ads and sandbox disabled |
| Experiments / A/B | 5.7 | Ready | Validity checks; human decisions required |
| Budget governance | 5.8 | Ready | Pacing, alerts, emergency controls, no autonomous increase |
| AI optimisation | 5.9 | Ready | Evidence-grounded; no autonomous provider action |
| Provider adapters | 5.6 | Partial | LinkedIn/TikTok on shared contract; Google/Meta parallel |
| Observability | 5.10 | Ready | Counters, readiness check, metrics API |
| Tenant isolation | — | Ready | organisationId + brandId on all queries |

## Acceptance criteria status

| Criterion | Status |
|-----------|--------|
| Campaign plans versioned | ✅ `AdvertisingCampaignVersion` |
| Every material mutation approved | ✅ 8 launch approval gates per provider |
| Approvals bind to exact mutation plans | ✅ SHA-256 plan hash binding |
| Provider operations idempotent | ✅ Idempotency keys per provider |
| Budget limits cannot be bypassed | ✅ Hard limits, emergency freeze |
| Emergency pause works | ✅ In-platform; provider API pause manual |
| Sensitive targeting blocked | ✅ Regex-based detection + policy |
| Provider limitations visible | ✅ Capability gates + provider matrix |
| No autonomous budget increase | ✅ Change request + approval workflow |
| No autonomous campaign launch | ✅ Launch approval gates required |
| AI recommendations evidence-grounded | ✅ Evidence package per run |
| Tenant isolation passes | ✅ Unit tests + service scoping |
| OAuth security passes | ✅ Encrypted token storage (platform) |
| Provider errors safely handled | ✅ Error recovery modules per provider |
| Production build passes | ✅ Verified in Task 5.10 |
| Release decision documented | ✅ This document |
| No critical security/financial risk | ✅ No unresolved critical issues |

## Beta scope recommendation

- OWNER or ADMIN role for provider launch and emergency controls
- MARKETER role for planning, drafting, experiments, optimisation reviews
- Provider-owned test accounts only (Google test, Meta sandbox, LinkedIn test, TikTok production with low spend)
- Maximum daily spend per account: organisation-configured hard limits
- Human approval required for all launches, budget increases, and material targeting changes

## Blockers

No unresolved **critical** security or financial-risk issues. See `docs/STAGE_5_KNOWN_LIMITATIONS.md` for restrictions.

## Related documents

- `docs/STAGE_5_SECURITY_REVIEW.md`
- `docs/STAGE_5_DATA_ACCURACY_REVIEW.md`
- `docs/STAGE_5_RELEASE_CHECKLIST.md`
- `docs/STAGE_5_KNOWN_LIMITATIONS.md`
- `docs/STAGE_5_PROVIDER_MATRIX.md`
- `docs/STAGE_5_BETA_SCOPE.md`
- `docs/STAGE_5_ROLLBACK.md`
- `docs/ADVERTISING_PLATFORM_RUNBOOK.md`
