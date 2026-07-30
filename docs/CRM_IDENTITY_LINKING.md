# CRM Identity Linking

## Deterministic link types

| Link type | Evidence required |
|-----------|-------------------|
| AUTH_USER | Authenticated application user ID |
| VERIFIED_EMAIL | Verified email address |
| CONFIRMED_PHONE | Confirmed phone number |
| CRM_EXTERNAL_ID | External CRM reference |
| STRIPE_CUSTOMER | Stripe customer ID |
| SOCIAL_LEAD | Social provider lead ID |
| MARKETING_IDENTITY | Marketing identity ID |
| MARKETING_LEAD | Marketing inbox lead ID |
| STAFF_CONFIRMED | Explicit staff confirmation |

## Auto-link eligibility

`canAutoLink` permits: AUTH_USER, VERIFIED_EMAIL, CONFIRMED_PHONE, STRIPE_CUSTOMER, MARKETING_LEAD when `verified !== false`.

STAFF_CONFIRMED always requires human action.

## Prohibited merge evidence

Never link or merge based solely on:

- Similar names
- Approximate location
- Device fingerprint
- Behavioural similarity
- AI confidence scores

`validateIdentityLink` rejects evidence strings containing prohibited types.

## Implementation

- `crmService.linkIdentity` creates `CrmIdentityLink` with `confirmedAt` and `confirmedByUserId`.
- Future workers may promote `MarketingLead` → `CrmLead` using `MARKETING_LEAD` link type.
