"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

type Identity = {
  provider: string;
  id?: string;
};

type SecuritySettingsFormProps = {
  identities: Identity[];
  hasPasswordIdentity: boolean;
};

export function SecuritySettingsForm({
  identities,
  hasPasswordIdentity,
}: SecuritySettingsFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Connected providers</h2>
          <p className="text-sm text-foreground-muted">
            Providers linked to your account for sign-in.
          </p>
        </div>
        <ul className="space-y-2">
          {hasPasswordIdentity ? (
            <li className="rounded-lg border border-border px-4 py-3 text-sm text-foreground-muted">
              Email and password
            </li>
          ) : null}
          {identities
            .filter((identity) => identity.provider !== "email")
            .map((identity) => (
              <li
                key={`${identity.provider}-${identity.id ?? "connected"}`}
                className="rounded-lg border border-border px-4 py-3 text-sm text-foreground-muted"
              >
                {identity.provider.charAt(0).toUpperCase()}
                {identity.provider.slice(1)}
              </li>
            ))}
        </ul>
        <OAuthButtons />
      </section>

      {hasPasswordIdentity ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Change password</h2>
            <p className="text-sm text-foreground-muted">
              Re-enter your current password before setting a new one.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <Input
              label="New password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <Input
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? <p className="text-sm text-green-700">{message}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
