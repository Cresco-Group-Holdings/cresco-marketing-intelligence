"use client";

import { useCallback, useEffect, useState } from "react";
import { NotificationCategory, NotificationChannel, NotificationDeliveryMode } from "@prisma/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { CRITICAL_NOTIFICATION_CATEGORIES } from "@/lib/notifications/constants";

type PreferenceRow = {
  id: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  deliveryMode: NotificationDeliveryMode;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
  isCriticalLocked: boolean;
};

const CATEGORIES = Object.values(NotificationCategory);

export function NotificationPreferencesForm() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [rows, setRows] = useState<PreferenceRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const data = await apiFetch<{ preferences: PreferenceRow[] }>(
      `/api/notifications/preferences?organisationId=${organisationId}`,
      { organisationId },
    );
    setRows(data.preferences);
  }, [organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(category: NotificationCategory) {
    if (!organisationId) return;
    const existing = rows.find((row) => row.category === category && row.channel === "EMAIL");
    await apiFetch(`/api/notifications/preferences?organisationId=${organisationId}`, {
      method: "PUT",
      organisationId,
      body: JSON.stringify({
        category,
        channel: "EMAIL",
        enabled: existing?.enabled ?? true,
        deliveryMode: existing?.deliveryMode ?? "IMMEDIATE",
        quietHoursStart: existing?.quietHoursStart ?? "22:00",
        quietHoursEnd: existing?.quietHoursEnd ?? "07:00",
        timezone: existing?.timezone ?? "UTC",
      }),
    });
    setMessage(`Saved ${category} preferences.`);
    await load();
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      {CATEGORIES.map((category) => {
        const row = rows.find((item) => item.category === category && item.channel === "EMAIL");
        const locked = CRITICAL_NOTIFICATION_CATEGORIES.includes(category);
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-slate-600">
                Delivery: {row?.deliveryMode ?? "IMMEDIATE"}
                {locked ? " · Critical notifications cannot be fully disabled." : ""}
              </p>
              <p className="text-slate-600">
                Quiet hours: {row?.quietHoursStart ?? "22:00"} – {row?.quietHoursEnd ?? "07:00"} (
                {row?.timezone ?? "UTC"})
              </p>
              <Button size="sm" variant="outline" onClick={() => void save(category)}>
                Save defaults
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
