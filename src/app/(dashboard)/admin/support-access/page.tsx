"use client";

import { useEffect, useState } from "react";
import { AdminCentreLayout } from "@/components/admin/admin-centre-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export default function AdminSupportAccessPage() {
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      reason: string;
      expiresAt: string;
      targetUser: { email: string };
      adminUser: { email: string };
    }>
  >([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    const data = await apiFetch<{ sessions: typeof sessions }>("/api/admin/support-access");
    setSessions(data.sessions);
  }

  useEffect(() => {
    void load();
  }, []);

  async function start() {
    await apiFetch("/api/admin/support-access", {
      method: "POST",
      body: JSON.stringify({ targetUserId, reason, durationMinutes: 60 }),
    });
    setTargetUserId("");
    setReason("");
    await load();
  }

  async function revoke(sessionId: string) {
    await apiFetch(`/api/admin/support-access/${sessionId}`, { method: "DELETE" });
    await load();
  }

  return (
    <AdminCentreLayout title="Support access">
      <Card className="mb-4 border-amber-200">
        <CardHeader><CardTitle>Start support session</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-amber-800">Requires explicit reason. Fully audited. Auto-expires.</p>
          <input className="w-full rounded border px-3 py-2" placeholder="Target user profile ID" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
          <textarea className="w-full rounded border px-3 py-2" placeholder="Reason (min 10 chars)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" onClick={() => void start()}>Start session</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {sessions.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between pt-4 text-sm">
              <div>
                <p className="font-medium">{s.targetUser.email}</p>
                <p className="text-slate-600">{s.reason}</p>
                <p className="text-xs">Expires {new Date(s.expiresAt).toLocaleString()}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void revoke(s.id)}>Revoke</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminCentreLayout>
  );
}
