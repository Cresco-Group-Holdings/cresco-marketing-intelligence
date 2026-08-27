"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function AcceptInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invitation token is missing.");
    }
  }, [token]);

  async function acceptInvitation() {
    if (!token) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      await apiFetch("/api/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setStatus("success");
      setMessage("Invitation accepted. Redirecting to your workspace...");
      window.setTimeout(() => {
        router.replace("/getting-started?invited=1");
      }, 1200);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to accept invitation.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Accept invitation</CardTitle>
          <CardDescription>
            Join your organisation on Cresco. Organisation details are only revealed after the
            invitation is validated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <p
              className={`text-sm ${
                status === "error" ? "text-red-700" : "text-foreground-muted"
              }`}
            >
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!token || status === "loading" || status === "success"}
              onClick={() => void acceptInvitation()}
            >
              {status === "loading" ? "Accepting..." : "Accept invitation"}
            </Button>
            <Link href="/login" className="inline-flex items-center text-sm hover:underline">
              Sign in with a different account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
