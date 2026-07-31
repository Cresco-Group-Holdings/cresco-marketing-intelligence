# Stage 3 Data Accuracy Review

## Metric definitions

All Stage 3 metrics use documented formulas in domain `constants.ts` files:

- Revenue: `src/lib/revenue/constants.ts` (`FORMULA_DEFINITIONS`)
- Executive: `src/lib/executive/constants.ts`
- Attribution: `src/lib/attribution/constants.ts`
- Funnels: `src/lib/funnel/constants.ts`

## Verified behaviours

| Area | Verification |
|------|-------------|
| Missing values | Executive/analyst show **Unavailable**, never zero |
| Refunds | Original amounts preserved; separate refund records |
| MRR | Sum of active/trialing subscription MRR amounts |
| CAC | Marketing spend / new customers when both available |
| LTV | Not calculated without explicit methodology |
| Attribution credits | Model-specific; documented in attribution UI |
| Funnel conversion | Latest completed analysis run per period |
| Currency | Mixed-currency warnings on paid ads and revenue |
| Timezone | Social analytics uses brand timezone for day boundaries |
| Comparison | Percent change suppressed when prior value is zero |

## Provider limitations (documented in UI)

- GSC: 2–3 day data delay
- GA4: Metric definition differences vs first-party
- Paid ads: Provider-specific attribution windows
- Stripe: Requires `brand_id` metadata for webhook routing
- Social metrics: Cumulative post metrics use latest observation

## AI accuracy controls

- Evidence package built before AI invocation
- Numeric whitelist validation on analyst output
- Claim type classification (fact, calculation, correlation, hypothesis)
- Correlation-is-not-causation disclaimers

## Outstanding accuracy gaps

- No cross-currency normalisation (reporting currency display only)
- Seasonal anomaly comparison is extension point
- Email performance metrics not yet connected
