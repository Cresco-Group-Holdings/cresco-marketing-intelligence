"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

type PrivacyLevel =
  "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

type ConsentContext = {
  account: { id: string; username: string; nickname: string };
  caption: string;
  previewUrl: string;
  creatorInfo: {
    privacyLevelOptions: PrivacyLevel[];
    commentDisabled: boolean;
    duetDisabled: boolean;
    stitchDisabled: boolean;
    maxVideoPostDurationSec: number;
  };
};

const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: "Public to everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends (mutual follows)",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

export function TikTokPublishPanel({
  brandId,
  organisationId,
  contentId,
  contentVariantId,
}: {
  brandId: string;
  organisationId: string;
  contentId: string;
  contentVariantId: string;
}) {
  const [context, setContext] = useState<ConsentContext | null>(null);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel | "">("");
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [commercialContent, setCommercialContent] = useState(false);
  const [brandOrganicToggle, setBrandOrganicToggle] = useState(false);
  const [brandedContentToggle, setBrandedContentToggle] = useState(false);
  const [audioRightsConfirmed, setAudioRightsConfirmed] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [fallbackJobId, setFallbackJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<ConsentContext>(
        `/api/brands/${brandId}/content/${contentId}/tiktok/settings?organisationId=${organisationId}&contentVariantId=${contentVariantId}`,
        { organisationId },
      );
      setContext(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load TikTok account settings.");
    }
  }, [brandId, organisationId, contentId, contentVariantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAndPublish() {
    if (!privacyLevel) {
      setError("Select a privacy level before publishing.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(
        `/api/brands/${brandId}/content/${contentId}/tiktok/settings?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            contentVariantId,
            privacyLevel,
            disableComment,
            disableDuet,
            disableStitch,
            commercialContent,
            brandOrganicToggle,
            brandedContentToggle,
            audioRightsConfirmed,
          }),
        },
      );

      const confirmed = window.confirm(
        `Publish to @${context?.account.username} as "${PRIVACY_LABELS[privacyLevel]}"?\n\nCaption: ${context?.caption ?? ""}`,
      );
      if (!confirmed) return;

      const result = await apiFetch<{ job: { id: string; directPublishAvailable: boolean } }>(
        `/api/brands/${brandId}/content/${contentId}/tiktok/publish?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            contentVariantId,
            socialAccountId: context?.account.id,
            confirmed: true,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      );
      setFallbackJobId(result.job.id);
      setMessage("Queued for publishing. Progress appears here once the worker runs.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "TikTok publishing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openFallbackPackage() {
    try {
      const data = await apiFetch<{ downloadUrl: string; instructions: string }>(
        `/api/brands/${brandId}/content/${contentId}/tiktok/fallback?organisationId=${organisationId}&contentVariantId=${contentVariantId}`,
        { organisationId },
      );
      window.open(data.downloadUrl, "_blank", "noopener");
      setMessage(data.instructions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to prepare the manual package.");
    }
  }

  async function confirmManual() {
    if (!fallbackJobId || !manualUrl) return;
    try {
      await apiFetch(
        `/api/brands/${brandId}/publishing-jobs/${fallbackJobId}/manual-confirm?organisationId=${organisationId}`,
        { method: "POST", organisationId, body: JSON.stringify({ publicUrl: manualUrl }) },
      );
      setMessage("Manual publication recorded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record the manual publication.");
    }
  }

  if (!context) {
    return (
      <p className="text-sm text-foreground-muted">{error ?? "Loading TikTok publishing options…"}</p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish to TikTok</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-medium">
            @{context.account.username} · {context.account.nickname}
          </p>
          <p className="text-foreground-muted">Caption: {context.caption}</p>
        </div>

        <video src={context.previewUrl} controls className="max-h-72 w-full rounded-md border" />

        <div>
          <label className="mb-1 block font-medium">Privacy level</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={privacyLevel}
            onChange={(event) => setPrivacyLevel(event.target.value as PrivacyLevel)}
          >
            <option value="">Select the visibility for this post</option>
            {context.creatorInfo.privacyLevelOptions.map((option) => (
              <option key={option} value={option}>
                {PRIVACY_LABELS[option]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-foreground-subtle">
            Only the options this TikTok account currently offers are listed. Nothing is
            preselected.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="font-medium">Interaction settings</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={disableComment || context.creatorInfo.commentDisabled}
              disabled={context.creatorInfo.commentDisabled}
              onChange={(event) => setDisableComment(event.target.checked)}
            />
            Turn off comments
            {context.creatorInfo.commentDisabled ? " (disabled on this account)" : ""}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={disableDuet || context.creatorInfo.duetDisabled}
              disabled={context.creatorInfo.duetDisabled}
              onChange={(event) => setDisableDuet(event.target.checked)}
            />
            Turn off Duet{context.creatorInfo.duetDisabled ? " (disabled on this account)" : ""}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={disableStitch || context.creatorInfo.stitchDisabled}
              disabled={context.creatorInfo.stitchDisabled}
              onChange={(event) => setDisableStitch(event.target.checked)}
            />
            Turn off Stitch{context.creatorInfo.stitchDisabled ? " (disabled on this account)" : ""}
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium">Commercial content disclosure</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={commercialContent}
              onChange={(event) => setCommercialContent(event.target.checked)}
            />
            This video promotes a brand, product, or service
          </label>
          {commercialContent ? (
            <div className="ml-6 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={brandOrganicToggle}
                  onChange={(event) => setBrandOrganicToggle(event.target.checked)}
                />
                Your brand — promoting yourself
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={brandedContentToggle}
                  onChange={(event) => setBrandedContentToggle(event.target.checked)}
                />
                Branded content — promoting another brand as a paid partnership
              </label>
            </div>
          ) : null}
        </fieldset>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={audioRightsConfirmed}
            onChange={(event) => setAudioRightsConfirmed(event.target.checked)}
          />
          I confirm this video&apos;s audio is licensed for commercial use
        </label>

        {error ? <p className="text-red-700">{error}</p> : null}
        {message ? <p className="text-foreground-muted">{message}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void saveAndPublish()}>
            {busy ? "Publishing…" : "Confirm & publish"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void openFallbackPackage()}>
            Download for manual posting
          </Button>
        </div>

        {fallbackJobId ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="font-medium">Posted manually?</p>
            <Input
              label="Public TikTok URL"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="https://www.tiktok.com/@account/video/..."
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
