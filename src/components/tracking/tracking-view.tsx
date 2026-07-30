"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type TrackingViewMode = "overview" | "properties" | "debugger" | "events" | "install";

const nav: Array<{ label: string; href: string; mode: TrackingViewMode }> = [
  { label: "Overview", href: "/data/tracking", mode: "overview" },
  { label: "Properties", href: "/data/tracking/properties", mode: "properties" },
  { label: "Debugger", href: "/data/tracking/debugger", mode: "debugger" },
  { label: "Events", href: "/data/tracking/events", mode: "events" },
  { label: "Install", href: "/data/tracking/install", mode: "install" },
];

export function TrackingView({ mode }: { mode: TrackingViewMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [properties, setProperties] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [propertyName, setPropertyName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const queryBase = useMemo(() => {
    const params = new URLSearchParams({ organisationId: organisationId ?? "" });
    if (brandId) params.set("brandId", brandId);
    return params;
  }, [organisationId, brandId]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/tracking/properties?${queryBase}`,
      { organisationId },
    );
    setProperties(data.items);

    const first = data.items[0];
    if (first && (mode === "events" || mode === "debugger")) {
      const eventData = await apiFetch<{ items: Array<Record<string, unknown>> }>(
        `/api/tracking/properties/${String(first.id)}?${queryBase}&view=events`,
        { organisationId },
      );
      setEvents(eventData.items);
    }
  }, [brandId, organisationId, queryBase, mode]);

  useEffect(() => {
    void load().catch(() => setMessage("Failed to load tracking data."));
  }, [load]);

  async function createProperty() {
    if (!propertyName.trim() || !brandId || !organisationId) return;
    await apiFetch("/api/tracking/properties", {
      method: "POST",
      organisationId,
      body: JSON.stringify({
        brandId,
        name: propertyName.trim(),
        domains: [],
      }),
    });
    setPropertyName("");
    setMessage("Property created.");
    await load();
  }

  const installSnippet = properties[0]
    ? `<script async src="${typeof window !== "undefined" ? window.location.origin : ""}/tracking/cresco-track.js"></script>
<script>
  window.CrescoTrack.init({ propertyId: "${String(properties[0].publicPropertyId)}" });
</script>`
    : "Create a tracking property first.";

  const latestEvent = events[0];
  const activeProperty = properties[0];
  const installations = (activeProperty?.installations as Array<Record<string, unknown>> | undefined) ?? [];
  const domains = (activeProperty?.domains as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="First-party tracking"
        description="Privacy-conscious website analytics for Cresco properties and future customer sites."
      />

      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "overview" && activeProperty ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property health</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>Status: <Badge>{String(activeProperty.status)}</Badge></p>
              <p className="mt-2 text-muted-foreground">
                Domains: {domains.length} verified
              </p>
              <p className="text-muted-foreground">
                Ingest logs: {String(activeProperty._count ? (activeProperty._count as { ingestLogs: number }).ingestLogs : 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Installation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {installations.length === 0 ? (
                <p className="text-muted-foreground">No SDK activity yet.</p>
              ) : (
                <>
                  <p>SDK: {String(installations[0]?.sdkVersion ?? "—")}</p>
                  <p className="text-muted-foreground">
                    Last seen: {String(installations[0]?.lastSeenAt ?? "—")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest event</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {latestEvent ? (
                <>
                  <p>{String(latestEvent.eventName)}</p>
                  <p className="text-muted-foreground">{String(latestEvent.receivedAt)}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Waiting for first event.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {(mode === "overview" || mode === "properties") && (
        <Card>
          <CardHeader>
            <CardTitle>Tracking properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                label="Property name"
                placeholder="Property name"
                value={propertyName}
                onChange={(event) => setPropertyName(event.target.value)}
              />
              <Button onClick={() => void createProperty()}>Create</Button>
            </div>
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties configured.</p>
            ) : (
              <ul className="space-y-2">
                {properties.map((property) => (
                  <li key={String(property.id)} className="rounded border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{String(property.name)}</strong>
                      <Badge>{String(property.status)}</Badge>
                    </div>
                    <p className="text-muted-foreground">ID: {String(property.publicPropertyId)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {(mode === "debugger" || mode === "events") && (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "debugger" ? "Live event debugger" : "Recent events"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "debugger" && activeProperty ? (
              <div className="rounded border bg-muted/40 p-3 text-sm">
                <p>Property: {String(activeProperty.name)}</p>
                <p className="text-muted-foreground">Public ID: {String(activeProperty.publicPropertyId)}</p>
                <p className="text-muted-foreground">SDK version: 1.0.0</p>
                <p className="text-muted-foreground">
                  Consent: set <code>window.__CRESCO_CONSENT__</code> before init
                </p>
              </div>
            ) : null}
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingest events yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {events.map((event) => (
                  <li key={String(event.id)} className="rounded border p-2">
                    <div className="flex justify-between gap-2">
                      <span>{String(event.eventName)}</span>
                      <Badge variant="muted">{String(event.status)}</Badge>
                    </div>
                    <p className="text-muted-foreground">{String(event.receivedAt)}</p>
                    {event.quarantineReason ? (
                      <p className="text-amber-600">{String(event.quarantineReason)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "install" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Standard JavaScript</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded bg-muted p-4 text-xs">{installSnippet}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next.js App Router</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded bg-muted p-4 text-xs">{`// app/layout.tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script src="/tracking/cresco-track.js" strategy="afterInteractive" />
        <Script id="cresco-init" strategy="afterInteractive">
          {\`window.CrescoTrack?.init({ propertyId: "${activeProperty ? String(activeProperty.publicPropertyId) : "YOUR_PROPERTY_ID"}" });\`}
        </Script>
      </body>
    </html>
  );
}`}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>React SPA</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded bg-muted p-4 text-xs">{`useEffect(() => {
  const script = document.createElement("script");
  script.src = "/tracking/cresco-track.js";
  script.async = true;
  script.onload = () => {
    window.CrescoTrack.init({ propertyId: "${activeProperty ? String(activeProperty.publicPropertyId) : "YOUR_PROPERTY_ID"}" });
  };
  document.head.appendChild(script);
}, []);`}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Server-side conversion API</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded bg-muted p-4 text-xs">{`const payload = JSON.stringify({
  propertyId: "${activeProperty ? String(activeProperty.publicPropertyId) : "YOUR_PROPERTY_ID"}",
  eventName: "signup_complete",
  occurredAt: new Date().toISOString(),
  userId: "user_123",
  idempotencyKey: "signup_user_123",
});
const signature = crypto.createHash("sha256").update(\`\${apiKey}:\${payload}\`).digest("hex");
await fetch("https://app.crescogroup.uk/api/tracking/v1/server-events", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-cresco-api-key": apiKey,
    "x-cresco-signature": signature,
  },
  body: payload,
});`}</pre>
              <p className="mt-3 text-sm text-muted-foreground">
                Generate an API key from property settings. Server-side events are preferred for
                conversions and never accept tenant IDs from the browser.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
