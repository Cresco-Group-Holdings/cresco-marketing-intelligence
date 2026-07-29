"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

type Variant = {
  id: string;
  provider: "LINKEDIN" | "FACEBOOK";
  socialAccountId: string;
  caption: string | null;
  headline?: string | null;
  destinationUrl?: string | null;
  format: string;
  socialAccount: {
    providerAccountId: string;
    accountType: string;
    displayName: string | null;
    username: string | null;
  };
};

export function LinkedInFacebookPublishPanel({
  brandId,
  organisationId,
  contentId,
  variant,
}: {
  brandId: string;
  organisationId: string;
  contentId: string;
  variant: Variant;
}) {
  const [authorType, setAuthorType] = useState<"MEMBER" | "ORGANISATION">(
    variant.socialAccount.accountType === "LINKEDIN_MEMBER" ? "MEMBER" : "ORGANISATION",
  );
  const [publishAsReel, setPublishAsReel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publish() {
    const identity =
      variant.socialAccount.displayName ??
      variant.socialAccount.username ??
      variant.socialAccount.providerAccountId;
    if (!window.confirm(`Publish this approved ${variant.provider} preview as ${identity}?`))
      return;
    setBusy(true);
    try {
      const endpoint = variant.provider === "LINKEDIN" ? "linkedin-publish" : "facebook-publish";
      await apiFetch(
        `/api/brands/${brandId}/content/${contentId}/${endpoint}?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            contentVariantId: variant.id,
            socialAccountId: variant.socialAccountId,
            confirmed: true,
            idempotencyKey: crypto.randomUUID(),
            ...(variant.provider === "LINKEDIN"
              ? { authorType, authorId: variant.socialAccount.providerAccountId }
              : { pageId: variant.socialAccount.providerAccountId, publishAsReel }),
          }),
        },
      );
      setMessage("Queued for publishing.");
    } finally {
      setBusy(false);
    }
  }

  const identity =
    variant.socialAccount.displayName ??
    variant.socialAccount.username ??
    variant.socialAccount.providerAccountId;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {variant.provider === "LINKEDIN" ? "LinkedIn preview" : "Facebook Page preview"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="font-medium">{identity}</p>
        {variant.headline ? <p className="font-semibold">{variant.headline}</p> : null}
        <p className="whitespace-pre-wrap">{variant.caption}</p>
        {variant.destinationUrl ? <p className="text-blue-700">{variant.destinationUrl}</p> : null}
        <p className="text-slate-500">Format: {variant.format}</p>
        {variant.provider === "LINKEDIN" ? (
          <div>
            <label className="mb-1 block font-medium">Post as</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={authorType}
              onChange={(event) => setAuthorType(event.target.value as "MEMBER" | "ORGANISATION")}
            >
              {variant.socialAccount.accountType === "LINKEDIN_MEMBER" ? (
                <option value="MEMBER">Member — {identity}</option>
              ) : (
                <option value="ORGANISATION">Organisation — {identity}</option>
              )}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Only the identity explicitly connected to this variant can be selected.
            </p>
          </div>
        ) : variant.format === "SHORT_VIDEO" ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={publishAsReel}
              onChange={(event) => setPublishAsReel(event.target.checked)}
            />
            Publish as a Facebook Reel where available for this Page
          </label>
        ) : null}
        {message ? <p className="text-slate-600">{message}</p> : null}
        <Button size="sm" disabled={busy} onClick={() => void publish()}>
          {busy
            ? "Queuing…"
            : `Confirm & publish to ${variant.provider === "LINKEDIN" ? "LinkedIn" : "Facebook"}`}
        </Button>
      </CardContent>
    </Card>
  );
}
