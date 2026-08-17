"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type OAuthButtonsProps = {
  redirect?: string;
};

export function OAuthButtons({ redirect }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startOAuth(provider: "google") {
    setError(null);
    setLoadingProvider(provider);

    try {
      const result = await apiFetch<{ url: string }>("/api/auth/oauth/google", {
        method: "POST",
        body: JSON.stringify({ provider, redirect }),
      });
      window.location.assign(result.url);
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : "Unable to start Google sign-in.");
      setLoadingProvider(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface-elevated px-2 text-foreground-subtle">Or continue with</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loadingProvider !== null}
        onClick={() => startOAuth("google")}
      >
        {loadingProvider === "google" ? "Redirecting..." : "Continue with Google"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
