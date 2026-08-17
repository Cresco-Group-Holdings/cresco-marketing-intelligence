"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { Input } from "@/components/ui/input";

export function YouTubeXPublishPanel({
  brandId,
  organisationId,
  contentId,
  variant,
}: {
  brandId: string;
  organisationId: string;
  contentId: string;
  variant: {
    id: string;
    provider: "YOUTUBE" | "X";
    socialAccountId: string;
    caption: string | null;
    headline?: string | null;
    socialAccount: {
      providerAccountId: string;
      displayName: string | null;
      username: string | null;
    };
  };
}) {
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [madeForKids, setMadeForKids] = useState<boolean | null>(null);
  const [thread, setThread] = useState(variant.caption ?? "");
  const [rights, setRights] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const identity =
    variant.socialAccount.displayName ??
    variant.socialAccount.username ??
    variant.socialAccount.providerAccountId;
  const posts = thread.split(/\n---\n/).filter(Boolean);

  async function publish() {
    if (!window.confirm(`Publish this approved preview to ${identity}?`)) return;
    const endpoint = variant.provider === "YOUTUBE" ? "youtube-publish" : "x-publish";
    const result = await apiFetch<{ job: { id: string } }>(
      `/api/brands/${brandId}/content/${contentId}/${endpoint}?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          contentVariantId: variant.id,
          socialAccountId: variant.socialAccountId,
          confirmed: true,
          idempotencyKey: crypto.randomUUID(),
          ...(variant.provider === "YOUTUBE"
            ? {
                title: variant.headline ?? "Untitled video",
                description: variant.caption ?? "",
                tags: [],
                categoryId: "22",
                privacyStatus: privacy,
                madeForKids,
                rightsConfirmed: rights,
              }
            : { posts, entitlementConfirmed: true }),
        }),
      },
    );
    setJobId(result.job.id);
    setMessage("Queued for publishing.");
  }

  async function fallback() {
    const result = await apiFetch<{ files: Array<{ url: string }>; status: string }>(
      `/api/brands/${brandId}/content/${contentId}/youtube-x-fallback?organisationId=${organisationId}&contentVariantId=${variant.id}`,
      { organisationId },
    );
    result.files.forEach((file) => window.open(file.url, "_blank", "noopener"));
    setMessage(result.status);
  }

  async function confirmManual() {
    if (!jobId || !manualUrl) return;
    await apiFetch(
      `/api/brands/${brandId}/publishing-jobs/${jobId}/manual-confirm?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ publicUrl: manualUrl }) },
    );
    setMessage("Manual publication recorded.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {variant.provider === "YOUTUBE"
            ? "YouTube video preview"
            : posts.length > 1
              ? "X thread preview"
              : "X post preview"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="font-medium">{identity}</p>
        <p>{variant.headline}</p>
        {variant.provider === "X" ? (
          <>
            <textarea
              className="min-h-28 w-full rounded-md border p-2"
              value={thread}
              onChange={(event) => setThread(event.target.value)}
            />
            <p
              className={
                posts.some((post) => post.length > 280) ? "text-red-700" : "text-foreground-subtle"
              }
            >
              {posts.length} post(s) · separate thread posts with a line containing --- ·{" "}
              {posts.map((post) => post.length).join(", ")} characters
            </p>
          </>
        ) : (
          <>
            <select
              className="w-full rounded-md border p-2"
              value={privacy}
              onChange={(event) => setPrivacy(event.target.value as typeof privacy)}
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
            <select
              className="w-full rounded-md border p-2"
              value={madeForKids === null ? "" : String(madeForKids)}
              onChange={(event) =>
                setMadeForKids(event.target.value === "" ? null : event.target.value === "true")
              }
            >
              <option value="">Select audience</option>
              <option value="false">Not made for kids</option>
              <option value="true">Made for kids</option>
            </select>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={rights}
                onChange={(event) => setRights(event.target.checked)}
              />
              I confirm video and music rights
            </label>
          </>
        )}
        {message ? <p>{message}</p> : null}
        <Button
          size="sm"
          disabled={variant.provider === "YOUTUBE" && (madeForKids === null || !rights)}
          onClick={() => void publish()}
        >
          Confirm & publish
        </Button>
        <Button size="sm" variant="outline" onClick={() => void fallback()}>
          Download manual publishing package
        </Button>
        {jobId ? (
          <div className="space-y-2 rounded-md border p-3">
            <Input
              label="Public URL after manual publishing"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!manualUrl}
              onClick={() => void confirmManual()}
            >
              Confirm manual publication
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
