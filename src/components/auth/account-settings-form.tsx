"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

type Profile = {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  locale: string | null;
};

type AccountSettingsFormProps = {
  initialProfile: Profile;
};

export function AccountSettingsForm({ initialProfile }: AccountSettingsFormProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const result = await apiFetch<{ profile: Profile }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profile.displayName,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          timezone: profile.timezone,
          locale: profile.locale,
        }),
      });
      setProfile(result.profile);
      setMessage("Account settings updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input label="Email address" name="email" value={profile.email} disabled />
      <Input
        label="Display name"
        name="displayName"
        value={profile.displayName ?? ""}
        onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          value={profile.firstName ?? ""}
          onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}
        />
        <Input
          label="Last name"
          name="lastName"
          value={profile.lastName ?? ""}
          onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}
        />
      </div>
      <Input
        label="Avatar URL"
        name="avatarUrl"
        type="url"
        hint="File upload is not available yet. Paste an image URL instead."
        value={profile.avatarUrl ?? ""}
        onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Timezone"
          name="timezone"
          value={profile.timezone ?? "UTC"}
          onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}
        />
        <Input
          label="Locale"
          name="locale"
          value={profile.locale ?? "en-GB"}
          onChange={(event) => setProfile({ ...profile, locale: event.target.value })}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
