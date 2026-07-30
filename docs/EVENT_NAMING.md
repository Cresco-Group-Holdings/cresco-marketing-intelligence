# Event Naming

## Standard events

| Event | Category | Description |
|-------|----------|-------------|
| `page_view` | Analytics | Page or route view |
| `session_start` | Essential | New session boundary |
| `cta_click` | Analytics | Call-to-action interaction |
| `outbound_click` | Analytics | External link click |
| `file_download` | Analytics | File download |
| `form_start` | Analytics | Form engagement start |
| `form_submit` | Analytics | Form submission |
| `signup_start` | Analytics | Registration started |
| `signup_complete` | Conversion | Registration completed (prefer server-side) |
| `email_verified` | Conversion | Email verification (prefer server-side) |
| `login_complete` | Analytics | User authenticated |
| `trial_start` | Conversion | Trial created (prefer server-side) |
| `demo_request` | Conversion | Demo requested (prefer server-side) |
| `subscription_start` | Conversion | Subscription started (prefer server-side) |
| `purchase` | Conversion | Payment completed (prefer server-side) |
| `report_imported` | Product | Report imported |
| `company_analysed` | Product | Company analysis completed |
| `grant_viewed` | Product | Grant detail viewed |
| `grant_saved` | Product | Grant saved |
| `grant_application_created` | Product | Grant application created |
| `custom_event` | Analytics | Named custom action via properties |

## Custom events

Custom event names must match:

```
^[a-z][a-z0-9_]{1,48}$
```

Use `custom_event` with an `action` property when a dedicated standard name is not appropriate:

```javascript
window.CrescoTrack.track("custom_event", { action: "filter_applied", filter: "sector" });
```

## Property restrictions

- Maximum 25 properties per event
- Keys max 64 characters, lowercased on ingest
- String values max 512 characters
- Blocked keys: `email`, `password`, `token`, `organisation_id`, `brand_id`, and similar sensitive fields

## Server-side preference

Use the [server-side events API](./SERVER_SIDE_EVENTS.md) for:

- `signup_complete`
- `email_verified`
- `trial_start`
- `demo_request`
- `subscription_start`
- `purchase`
- CRM qualification events
- Payment and refund events

Browser events are suitable for behavioural signals; server events provide authoritative conversion evidence.
