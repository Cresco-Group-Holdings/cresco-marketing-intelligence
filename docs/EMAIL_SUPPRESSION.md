# Email Suppression

## Suppression reasons

| Reason | Source | Blocks marketing | Blocks transactional |
|--------|--------|------------------|---------------------|
| UNSUBSCRIBE | Link, webhook | Yes | No |
| HARD_BOUNCE | Webhook | Yes | Yes |
| COMPLAINT | Webhook | Yes | Yes |
| MANUAL | Admin action | Yes | No* |
| LEGAL_DELETION | GDPR request | Yes | Yes |
| INVALID_ADDRESS | Validation | Yes | Yes |
| PROVIDER_SUPPRESSION | Provider sync | Yes | Varies |
| TENANT_BLOCK | Admin block | Yes | Yes |

*Manual suppression blocks marketing; transactional may still send unless reason is complaint/hard bounce.

## Enforcement

`queueMessage` checks suppression and unsubscribe lists before creating recipients. Marketing sends cannot bypass suppression under any circumstance.

## Unsubscribe

`EmailUnsubscribe` records are category-scoped. Marketing unsubscribes also create suppression entries.

## Management

- `addSuppression` — manual add (requires `email.manageSuppressions`)
- `removeSuppression` — manual removal (audit logged)
- Webhook processing auto-creates suppressions for bounces and complaints
