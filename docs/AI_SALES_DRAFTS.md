# AI Sales Drafts

The lifecycle agent can propose message drafts for human review. Drafts are **never sent automatically** — all outreach requires explicit human review and manual send.

## Draft Types

| Type | Purpose |
|------|---------|
| `EMAIL` | Email follow-up or outreach |
| `CALL_SCRIPT` | Call preparation script |
| `MEETING_AGENDA` | Meeting agenda outline |
| `RENEWAL_OUTREACH` | Renewal conversation draft |
| `TRIAL_CHECK_IN` | Trial check-in message |
| `FOLLOW_UP` | General follow-up message |

## Validation

`validateDraft()` in `src/lib/lifecycle-agent/drafts.ts` checks:

- Valid draft type
- Non-empty body
- Email subject warning (if missing)
- Commercial safety rules (see below)

## Commercial Safety Rules

`checkDraftSafety()` blocks drafts containing:

### Unverified Pricing (`UNVERIFIED_PRICING`)

- Currency amounts (`$`, `£`, `€` followed by digits)
- Percentage-off language
- "Special rate/price/offer" claims
- "We can offer you" pricing language

### Unverified Discounts (`UNVERIFIED_DISCOUNT`)

- Percentage discount offers
- Exclusive discount language
- Reduced rate claims
- Fee waivers
- Free month/trial extension/upgrade offers

### Fabricated Urgency (`FABRICATED_URGENCY`)

- "Act now", "limited time only", "expires today"
- "Last chance", "don't miss out"
- "Offer ends tonight/today/soon"
- "Immediate action required"
- "Final notice/warning/reminder"

### Fabricated Promises (`FABRICATED_PROMISE`)

- Guaranteed results/success/ROI
- "We promise" language
- "You will definitely/certainly" claims
- "100% success/satisfaction/guaranteed"
- "Approved by legal/management" claims

### Auto-Send Implications (`AUTO_SEND_MESSAGE`)

- "Auto-send" language
- "Sending this now/immediately" language

## Review Guidance

Safe drafts should include "review before sending" guidance. A warning is added when this guidance is absent.

## Workflow

1. Agent proposes a `DRAFT_MESSAGE` action (requires approval)
2. Draft content is validated via `validateDraft()` / `checkDraftSafety()`
3. Unsafe drafts are blocked with specific error reasons
4. Approved drafts are stored as `LifecycleAgentDraft` records
5. Human reviews, edits if needed, and sends manually via CRM or email tools

## Consent Eligibility

Drafts for contacts with consent or suppression restrictions are flagged. Outreach drafts require consent review before use (`consentEligible` field on `LifecycleAgentDraft`).

## Related

- [LIFECYCLE_AGENT_SAFETY.md](./LIFECYCLE_AGENT_SAFETY.md) — broader safety guardrails
- [AI_SALES_LIFECYCLE_AGENT.md](./AI_SALES_LIFECYCLE_AGENT.md) — lifecycle agent overview
