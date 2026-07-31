# Consent Tracking

> This document describes technical consent behaviour in the Cresco tracking system. It is not legal advice. Consult qualified counsel for GDPR, PECR, or other regulatory obligations.

## Consent categories

| Category | Purpose |
|----------|---------|
| `ESSENTIAL` | Operational session boundaries required for basic measurement |
| `ANALYTICS` | Page views, clicks, forms, and custom behavioural events |
| `MARKETING` | Conversion and campaign attribution events |
| `PERSONALISATION` | Reserved for future personalisation features |

## SDK behaviour

1. Read consent from `window.__CRESCO_CONSENT__` or `CrescoTrack.setConsent()`
2. Include consent state on every event payload
3. Suppress optional events when consent is absent or denied
4. Always permit `session_start` (essential operational event)
5. Propagate consent metadata to `MarketingSession.consentState`

## Gating rules

| Mode | Rule |
|------|------|
| Default | Analytics events allowed unless `ANALYTICS: false` |
| Cookieless | Analytics events require explicit `ANALYTICS: true` |
| Marketing conversions | `purchase`, `subscription_start`, `trial_start`, `signup_complete` suppressed when `MARKETING: false` |

## Example

```javascript
window.__CRESCO_CONSENT__ = {
  ESSENTIAL: true,
  ANALYTICS: false,
  MARKETING: false,
  PERSONALISATION: false,
};
window.CrescoTrack.init({ propertyId: "prop_..." });
// session_start is sent; page_view is suppressed server-side
```

## Cookieless measurement

Enable `cookielessMode` on a tracking property to require explicit analytics consent before accepting behavioural events. Anonymous and session IDs still use `sessionStorage` for the browser session only.

## Consent updates

When consent changes, call `CrescoTrack.setConsent(newState)`. The SDK emits a `custom_event` with `action: consent_updated` when analytics consent is available.

## Server-side events

Authenticated server-side conversion events bypass browser consent checks but still record tenant context from the tracking property, not from the client payload.
