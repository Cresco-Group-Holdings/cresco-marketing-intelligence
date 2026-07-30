# Email Infrastructure

Provider-independent email sending layer for transactional, operational, and marketing communications.

## Architecture

```
Brand → EmailProviderConnection → EmailSendingDomain → EmailSenderIdentity
                                              ↓
                                    EmailMessage (queued)
                                              ↓
                              Provider Adapter (SES/SendGrid/etc.)
                                              ↓
                              EmailDeliveryEvent (webhooks)
```

## Models

16 models covering providers, domains, senders, templates, messages, events, suppression, and deliverability snapshots.

## API

`GET/POST /api/brands/{brandId}/email`

Views: `providers`, `domains`, `senders`, `templates`, `messages`, `suppressions`, `deliverability`, `trackingPolicy`

## Permissions

`email.read`, `email.manageProviders`, `email.manageDomains`, `email.manageSenders`, `email.manageTemplates`, `email.approveTemplates`, `email.sendTest`, `email.sendTransactional`, `email.sendMarketing`, `email.manageSuppressions`, `email.viewDeliverability`

## UI routes

- `/email` — overview
- `/email/providers`, `/email/domains`, `/email/senders`
- `/email/templates`, `/email/messages`
- `/email/suppressions`, `/email/deliverability`

## Send pipeline

Messages are persisted as `QUEUED` or `SCHEDULED` before dispatch. No production send relies on in-memory execution alone. Supports idempotency keys, retries, cancellation, and tenant quotas.

## Not in scope

Multi-step automation workflows (later task).
