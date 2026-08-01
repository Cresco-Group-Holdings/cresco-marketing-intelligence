"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const result = await apiFetch<{ message: string }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      setMessage(result.message);
      router.push("/verify-email");
    } catch (submitError) {
      const fallback = "The registration service is temporarily unavailable.";
      if (submitError instanceof Error) {
        setError(
          submitError.message === "The service is temporarily unavailable."
            ? fallback
            : submitError.message,
        );
      } else {
        setError(fallback);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <Input
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
        <Input
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters with upper, lower, and numeric characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <OAuthButtons />
    </div>
  );
}
