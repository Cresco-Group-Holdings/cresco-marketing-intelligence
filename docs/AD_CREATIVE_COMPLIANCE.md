# Ad Creative Compliance

Compliance integrates brand knowledge, content safety scanning, and long-form compliance rules.

## Check types

| Rule | Severity |
|------|----------|
| prohibited-claim | BLOCKING |
| unsupported-superlative | MEDIUM |
| deceptive-urgency | MEDIUM |
| health-claim | HIGH/BLOCKING |
| employment-claim | HIGH/BLOCKING |
| personal-attribute-targeting | BLOCKING |
| before-after-claim | HIGH/BLOCKING |
| FINANCIAL_GUARANTEE (AI safety) | BLOCKING |
| FABRICATED_RESULTS | WARNING |

## Brand safety

Applied from brand knowledge:

- prohibited vocabulary and claims
- compliance rules (`BrandComplianceRule`)
- tone and messaging guidelines

## Review roles

- MARKETER, BRAND_OWNER, COMPLIANCE_REVIEWER, BUDGET_OWNER, CLIENT_APPROVER

Blocking findings prevent `submit-review`. Compliance reviewer approval required before project reaches `APPROVED`.

## Principles

- Flag unsupported superlatives and guarantees
- Do not auto-approve AI-generated copy
- No automatic publishing after approval
