# V1 Data Accuracy Review

Audit of metrics formulas, data handling, and known accuracy limitations across Stages 1–6.

## Summary

| Principle | Status | Implementation |
|-----------|--------|----------------|
| Documented formulas | ✅ | Constants files per domain |
| Missing data → Unavailable | ✅ | Never substitute zero |
| Provider limitations disclosed | ✅ | UI disclaimers and docs |
| AI outputs evidence-grounded | ✅ | Evidence packages; numeric whitelist |
| Deterministic scoring | ✅ | Lead scoring rules only |
| Mixed-currency warnings | ✅ | Paid ads and revenue |

**No critical accuracy issues. Limitations are documented and surfaced in UI.**

## Formula references

| Domain | Location | Key metrics |
|--------|----------|-------------|
| Revenue | `src/lib/revenue/constants.ts` | MRR, CAC, churn, `FORMULA_DEFINITIONS` |
| Executive dashboard | `src/lib/executive/constants.ts` | Cross-channel KPIs, comparisons |
| Attribution | `src/lib/attribution/constants.ts` | 8 models, credit allocation |
| Funnels | `src/lib/funnel/constants.ts` | Conversion rates, drop-off |
| Pipeline | `src/lib/crm-pipelines/constants.ts` | Forecast, health, velocity |
| Lead scoring | `src/lib/lead-scoring/scoring.ts` | FIT + ENGAGEMENT + NEGATIVE composite |
| Email campaigns | `src/lib/email-campaigns/analytics.ts` | Open/click/bounce rates |
| Advertising | `src/lib/advertising-budget-governance/` | Pacing, spend alerts |

## Verified behaviours

| Area | Behaviour |
|------|-----------|
| Missing connector data | Executive/analyst show **Unavailable** |
| Zero prior period | Percent change suppressed |
| Refunds | Original amounts preserved; separate records |
| MRR | Sum of active/trialing subscription MRR |
| CAC | Marketing spend / new customers when both available |
| LTV | Not calculated without explicit methodology |
| Attribution credits | Model-specific; documented in UI |
| Funnel conversion | Latest completed analysis run per period |
| Currency | Mixed-currency warnings on paid ads and revenue |
| Timezone | Brand timezone for day boundaries (social, email) |
| Lead score | Capped at composite 100; negative floor at 0 |
| Pipeline forecast | Weighted by stage probability; stale data flagged |

## Stage-specific accuracy notes

### Stage 3 — Analytics

| Source | Limitation |
|--------|------------|
| GSC | 2–3 day data delay |
| GA4 | Metric definition differences vs first-party |
| Paid ads | Provider-specific attribution windows |
| Stripe | Requires `brand_id` metadata for webhook routing |
| Social metrics | Cumulative post metrics use latest observation |

Reference: `docs/STAGE_3_DATA_ACCURACY_REVIEW.md`

### Stage 4 — SEO

| Metric | Limitation |
|--------|------------|
| Rank positions | Licensed sources; GSC delay |
| Crawl coverage | No JavaScript rendering |
| Competitor data | Excerpt truncation; bounded crawl |
| AI content claims | Claim review workflow; not fact-checked against live web |

Reference: `docs/STAGE_4_DATA_ACCURACY_REVIEW.md`, `docs/RANK_TRACKING_LIMITATIONS.md`

### Stage 5 — Advertising

| Metric | Limitation |
|--------|------------|
| Spend pacing | Cross-currency FX excludes unknown rates |
| Conversion data | Requires provider-side tracking setup |
| Experiment validity | Platform disclaimer on randomisation |
| Policy compliance | Client-side rules; not live provider API validation |

Reference: `docs/STAGE_5_DATA_ACCURACY_REVIEW.md`

### Stage 6 — CRM & Email

| Metric | Limitation |
|--------|------------|
| Email open/click rates | Pixel/link tracking; bot filtering partial |
| Pipeline forecast | Requires stage probability configuration |
| Lead score decay | Linear/exponential; configurable half-life |
| Lifecycle agent priority | Deal value explicitly excluded |
| Form attribution | UTM captured; multi-touch not auto-linked |
| Automation conversion | Journey-level; not full attribution model |

## AI accuracy controls

| Agent | Control |
|-------|---------|
| Marketing analyst | Evidence package; numeric whitelist; deterministic fallback |
| SEO briefs | Evidence from crawl/GSC data; approval workflow |
| Advertising optimisation | Rule-based analysis; evidence per recommendation |
| Lifecycle agent | Data confidence scoring; LOW confidence suppresses findings |
| Lead scoring AI | Explains rules only; cannot modify scores |

Correlation-is-not-causation disclaimers on analyst and optimisation outputs.

## Outstanding accuracy gaps

| Gap | Impact | Workaround |
|-----|--------|------------|
| No cross-currency normalisation | Mixed-currency totals incomplete | Warning banners; reporting currency display |
| Seasonal anomaly detection | Extension point only | Manual analyst review |
| Email ↔ attribution bridge | Email metrics not in attribution engine | Use campaign analytics directly |
| MarketingLead ↔ CrmLead | Separate score/activity histories | Manual bridge or future sync job |
| Real-time pipeline updates | Eventual consistency on activity sync | Refresh dashboard; check `lastActivityAt` |
| Provider billing reconciliation | Platform spend may differ from provider | Weekly manual reconciliation (advertising) |

## Data quality controls

- Warehouse freshness SLA and quality rules (Stage 3)
- `marketingDataSourceHealth` status tracking
- SEO crawl quality checks
- Email deliverability monitoring (bounce/complaint rates)
- Lead scoring simulation before model activation

## Recommendations for beta

1. Display Unavailable metrics prominently — do not interpret as zero
2. Run lead scoring simulation before activating models
3. Reconcile advertising spend weekly against provider billing
4. Verify Stripe `brand_id` metadata before trusting revenue KPIs
5. Review lifecycle agent data confidence warnings before acting on recommendations

## Sign-off

| Check | Status |
|-------|--------|
| Formulas documented in code | ✅ |
| Unavailable-not-zero verified | ✅ |
| AI evidence packages required | ✅ |
| Known limitations documented | ✅ |
