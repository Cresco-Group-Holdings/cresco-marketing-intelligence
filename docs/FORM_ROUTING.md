# Form Routing

## Rule model

`LeadCaptureRule` — deterministic rules evaluated in priority order.

### Conditions

```json
{ "field": "country", "operator": "eq", "value": "GB" }
```

Operators: `eq`, `neq`, `in`, `exists`

### Context

- Form type
- Brand ID
- Field values from submission
- Country, language, company size (extension points)

## Actions

| Action | Effect |
|--------|--------|
| ASSIGN_OWNER | Set CRM lead owner |
| APPLY_TAG | Apply lead tag (extension) |
| SET_PRODUCT_INTEREST | Set `primaryProductInterest` |
| CREATE_TASK | Create task (extension) |
| ADD_NURTURE | Add to nurture workflow (extension) |
| NOTIFY_TEAM | Send notification (extension) |
| CREATE_OPPORTUNITY_PROPOSAL | Create opportunity (extension) |

Task 6.2 implements: `ASSIGN_OWNER`, `SET_PRODUCT_INTEREST` (via CRM lead creation).

## Evaluation

`evaluateRoutingRules()` — first matching rule by ascending priority wins.

No AI or probabilistic routing.

## CRM linkage

Routing executes after spam check passes and before/alongside CRM lead creation in `leadCaptureSubmissionService.submit()`.
