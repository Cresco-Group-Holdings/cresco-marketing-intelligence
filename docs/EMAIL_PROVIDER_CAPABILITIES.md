# Email Provider Capabilities Audit

Provider-independent email infrastructure. The domain layer uses adapter interfaces — no single provider is hard-coded.

## Comparison matrix

| Capability | Amazon SES | SendGrid | Mailgun | Postmark | Resend | Custom SMTP |
|------------|-----------|----------|---------|----------|--------|-------------|
| Transactional | Yes | Yes | Yes | Yes (primary) | Yes | Depends |
| Marketing bulk | Yes | Yes | Yes | Limited | Yes | Depends |
| Domain verification | DNS (SPF/DKIM/DMARC) | DNS | DNS | DNS | DNS | Manual |
| Dedicated IPs | Yes (paid) | Yes (paid) | Yes (paid) | Yes (paid) | No | N/A |
| Webhooks | SNS or HTTP | Event Webhook | Routes | Webhooks | Webhooks | None |
| Suppression lists | Account-level | Global + group | Suppressions API | Suppressions | Audience | Manual |
| Bounce handling | SNS notifications | Event stream | Webhooks | Webhooks | Webhooks | Manual |
| Complaint handling | SNS (feedback loop) | Event stream | Webhooks | Webhooks | Webhooks | Manual |
| Open tracking | Optional pixel | Yes | Yes | Yes | Yes | No |
| Click tracking | Optional | Yes | Yes | Yes | Yes | No |
| Rate limits | Account/region | Plan-based | Plan-based | Plan-based | Plan-based | Server-defined |
| EU data residency | Region selection | Subuser region | EU region | EU infra | EU option | Self-hosted |
| SMTP relay | Yes | Yes | Yes | Yes | Yes | Yes |
| API send | Yes | Yes | Yes | Yes | Yes | N/A |

## Commercial considerations

- **Amazon SES**: Lowest cost at scale; requires AWS account and reputation warm-up; SNS for webhooks.
- **SendGrid**: Broad feature set; Twilio ownership; strong marketing + transactional.
- **Mailgun**: Developer-friendly; good logs; owned by Sinch.
- **Postmark**: Best-in-class transactional deliverability; not ideal for bulk marketing.
- **Resend**: Modern API; fast integration; newer platform with growing enterprise features.
- **Custom SMTP**: Enterprise customers may supply own relay; limited webhook/automation; manual suppression sync.

## Platform adapter design

Each provider implements `EmailProviderAdapter`:

- `verifyDomain(domain, config)` — initiate/check DNS verification
- `verifySender(identity)` — sender authentication
- `send(message, recipients)` — returns provider message ID
- `parseWebhook(payload, signature)` — normalised delivery events
- `normaliseBounce(event)` / `normaliseComplaint(event)`

Credentials stored as `credentialsRef` (secret manager reference), never in application logs.

## Selection guidance

| Use case | Recommended |
|----------|-------------|
| High-volume transactional | SES, Postmark |
| Marketing + nurture | SendGrid, Mailgun |
| Rapid MVP / dev | Resend |
| Enterprise BYO relay | Custom SMTP adapter |
| Mixed tenant providers | Per-tenant `EmailProviderConnection` |

## Not in scope (Task 6.5)

- Multi-step automation workflows
- Visual email builder
- A/B testing at send time
- List segmentation engine

These build on this infrastructure in later tasks.
