# Tracking SDK

The Cresco browser SDK (`/tracking/cresco-track.js`) is a lightweight, asynchronous tracker for first-party analytics.

## Quick start

```html
<script async src="https://app.crescogroup.uk/tracking/cresco-track.js"></script>
<script>
  window.CrescoTrack.init({ propertyId: "prop_YOUR_PUBLIC_ID" });
</script>
```

## Configuration

```javascript
window.CrescoTrack.init({
  propertyId: "prop_...",           // required public property ID
  endpoint: "/api/tracking/v1/events" // optional; defaults to first-party path
});
```

## Automatic events

On `init`, the SDK sends:

1. `session_start`
2. `page_view`

SPA route changes (via `history.pushState` and `popstate`) trigger additional `page_view` events.

## Manual tracking

```javascript
window.CrescoTrack.track("cta_click", { label: "Book demo", section: "hero" });
window.CrescoTrack.pageView();
window.CrescoTrack.identify("user_123"); // emits login_complete with userId
window.CrescoTrack.setConsent({ ESSENTIAL: true, ANALYTICS: true, MARKETING: false });
window.CrescoTrack.flush();
```

## CTA tracking

Add `data-cresco-track` to any element:

```html
<a href="/demo" data-cresco-track="cta_click" data-cresco-label="Book demo">Book demo</a>
```

## Consent

Set consent before or after init:

```javascript
window.__CRESCO_CONSENT__ = {
  ESSENTIAL: true,
  ANALYTICS: true,
  MARKETING: false,
  PERSONALISATION: false,
};
```

Or call `CrescoTrack.setConsent(state)`.

## Identity

- Anonymous ID and session ID are stored in `sessionStorage` (not `localStorage`)
- `identify(userId)` links the anonymous visitor to an authenticated user server-side
- Never send raw email addresses through browser events

## Behaviour

| Property | Value |
|----------|-------|
| Bundle | Single IIFE, no dependencies |
| Loading | Async, non-blocking |
| Transport | `sendBeacon` with `fetch` fallback |
| Batching | Up to 20 events per request, 2s debounce |
| Failure mode | Silent drop; never throws to the page |

## SDK version

Current version: **1.0.0** (`window.CrescoTrack.version`)
