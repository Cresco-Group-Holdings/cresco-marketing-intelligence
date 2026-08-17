"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiFetch<{ redirectTo: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ password, confirmPassword }),
      });
      router.push(result.redirectTo);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 12 characters with upper, lower, and numeric characters."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
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
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Updating password..." : "Update password"}
      </Button>
    </form>
  );
}
