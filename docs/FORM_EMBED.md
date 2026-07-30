# Form Embed

## Installation options

### JavaScript embed (CSP-compatible)

```html
<script src="/embed/forms.js" data-form-id="PUBLIC_FORM_ID" async></script>
<div id="cresco-form-PUBLIC_FORM_ID"></div>
```

CSP requirements:
- `script-src` must allow the Cresco embed script origin
- `connect-src` must allow the submission API origin
- No `unsafe-inline` required for form rendering

### iframe embed

```html
<iframe src="/forms/hosted/PUBLIC_FORM_ID" title="Contact form" sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
```

### API submission (server-side)

```http
POST /api/forms/v1/{publicFormId}/submit
Content-Type: application/json
X-Idempotency-Key: unique-client-key

{
  "fields": { "email": "user@example.com", "first_name": "Alex" },
  "consent": [{ "purpose": "SERVICE_REQUEST", "granted": true, "wordingVersion": "v1" }],
  "attribution": {
    "pageUrl": "https://example.com/contact",
    "utmSource": "google",
    "utmCampaign": "spring"
  }
}
```

### React component

Import from `@/components/forms/embed` (extension point for Cresco applications).

## Origin allowlist

Configure `allowedOrigins` on the form. Submissions from unlisted origins are quarantined.

## Attribution capture

Embed scripts should pass `attribution` object with page URL, referrer, UTM parameters, and first-party anonymous/session IDs where consent permits.
