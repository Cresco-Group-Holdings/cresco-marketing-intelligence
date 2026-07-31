# Tracking Installation

## Prerequisites

1. Create a tracking property in **Data Hub → Tracking → Properties**
2. Add verified domains with matching `allowedOrigin` values
3. Copy the public property ID (`prop_...`)

## Standard JavaScript website

```html
<script async src="https://app.crescogroup.uk/tracking/cresco-track.js"></script>
<script>
  window.__CRESCO_CONSENT__ = { ESSENTIAL: true, ANALYTICS: true, MARKETING: false };
  window.CrescoTrack.init({
    propertyId: "prop_YOUR_ID",
    endpoint: "https://app.crescogroup.uk/api/tracking/v1/events",
  });
</script>
```

For customer sites on a different domain, point `endpoint` at your Cresco collector host. The origin must match a verified domain on the property.

## Next.js App Router

```tsx
// app/layout.tsx
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="/tracking/cresco-track.js" strategy="afterInteractive" />
        <Script id="cresco-init" strategy="afterInteractive">
          {`window.CrescoTrack?.init({ propertyId: "${process.env.NEXT_PUBLIC_CRESCO_PROPERTY_ID}" });`}
        </Script>
      </body>
    </html>
  );
}
```

Set `NEXT_PUBLIC_CRESCO_PROPERTY_ID` in environment variables. Never expose API keys in client code.

## React SPA

```tsx
import { useEffect } from "react";

export function CrescoTracking() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://app.crescogroup.uk/tracking/cresco-track.js";
    script.async = true;
    script.onload = () => {
      window.CrescoTrack.init({ propertyId: import.meta.env.VITE_CRESCO_PROPERTY_ID });
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);
  return null;
}
```

## Server-side conversion API

See [Server-side events](./SERVER_SIDE_EVENTS.md). Use API keys only on the server.

```javascript
// app/api/webhooks/stripe/route.ts (example)
import { createHash } from "node:crypto";

export async function POST(request: Request) {
  const payload = JSON.stringify({
    propertyId: process.env.CRESCO_PROPERTY_ID,
    eventName: "purchase",
    occurredAt: new Date().toISOString(),
    userId: "user_from_session",
    customerId: "cus_stripe_id",
    idempotencyKey: `purchase_${event.id}`,
    properties: { amount: 9900, currency: "GBP" },
  });

  const apiKey = process.env.CRESCO_TRACKING_API_KEY!;
  const signature = createHash("sha256").update(`${apiKey}:${payload}`).digest("hex");

  await fetch(`${process.env.CRESCO_COLLECTOR_URL}/api/tracking/v1/server-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cresco-api-key": apiKey,
      "x-cresco-signature": signature,
    },
    body: payload,
  });
}
```

## Verification checklist

1. Open **Data Hub → Tracking → Debugger**
2. Confirm `session_start` and `page_view` appear with status `ACCEPTED`
3. Check installation status shows SDK version and last seen timestamp
4. Test consent suppression by setting `ANALYTICS: false`
5. Verify origin errors when testing from an unlisted domain

## Cresco property mapping

| Site | Suggested property name |
|------|-------------------------|
| crescogroup.uk | Cresco Group UK |
| crescogrants.com | Cresco Grants Marketing |
| app.crescogrants.com | Cresco Grants App |
| capitalcresco.com | Capital Cresco Marketing |
| app.capitalcresco.com | Capital Cresco App |

Each property should include production domain verification before go-live.
