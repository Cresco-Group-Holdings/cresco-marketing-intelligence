"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type SessionResponse = {
  authenticated: boolean;
  emailVerified: boolean;
  session: {
    expiresAt?: number;
    expiresIn?: number;
  } | null;
  identities: Array<{ provider: string }>;
  user: {
    id: string;
    email: string;
  } | null;
};

export function SessionsSettings() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const result = await apiFetch<SessionResponse>("/api/auth/session");
        setSession(result);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load session.");
      } finally {
        setLoading(false);
      }
    }

    void loadSession();
  }, []);

  async function revokeAllSessions() {
    setRevoking(true);
    setMessage(null);
    setError(null);

    try {
      await apiFetch("/api/auth/session", { method: "DELETE" });
      setMessage("All sessions were revoked. Sign in again to continue.");
      router.push("/login");
      router.refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke sessions.");
    } finally {
      setRevoking(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading session details...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Current session</h2>
        <dl className="mt-3 space-y-2 text-sm text-foreground-muted">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>{session?.authenticated ? "Active" : "Inactive"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Email verified</dt>
            <dd>{session?.emailVerified ? "Yes" : "No"}</dd>
          </div>
          {session?.session?.expiresAt ? (
            <div className="flex justify-between gap-4">
              <dt>Expires</dt>
              <dd>{new Date(session.session.expiresAt * 1000).toLocaleString()}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt>Providers</dt>
            <dd>{session?.identities.map((identity) => identity.provider).join(", ") || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sign out everywhere</h2>
          <p className="text-sm text-foreground-muted">
            Revoke all active sessions for this account, including this browser.
          </p>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <Button type="button" variant="outline" onClick={revokeAllSessions} disabled={revoking}>
          {revoking ? "Revoking..." : "Revoke all sessions"}
        </Button>
      </section>
    </div>
  );
}
