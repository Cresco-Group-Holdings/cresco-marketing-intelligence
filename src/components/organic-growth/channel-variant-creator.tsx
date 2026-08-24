"use client";

import { useMemo, useState } from "react";
import { BrandMarketingChannel, ContentType } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { buildVariantDraftsFromSource } from "@/lib/organic-growth/validation";
import { ORGANIC_PROVIDER_REGISTRY } from "@/lib/organic-growth/providers";

const CHANNEL_OPTIONS = ORGANIC_PROVIDER_REGISTRY.filter(
  (provider) =>
    provider.tier === "core" &&
    provider.availability !== "coming_soon" &&
    provider.availability !== "planned" &&
    ["LINKEDIN", "X", "INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE"].includes(
      String(provider.provider),
    ),
).map((provider) => ({
  key: String(provider.provider),
  label: provider.label,
}));

const PROVIDER_TO_MARKETING_CHANNEL: Record<string, BrandMarketingChannel> = {
  LINKEDIN: BrandMarketingChannel.LINKEDIN,
  X: BrandMarketingChannel.X,
  INSTAGRAM: BrandMarketingChannel.INSTAGRAM,
  FACEBOOK: BrandMarketingChannel.FACEBOOK,
  TIKTOK: BrandMarketingChannel.TIKTOK,
  YOUTUBE: BrandMarketingChannel.YOUTUBE,
};

const FORMAT_TO_CONTENT_TYPE: Record<string, ContentType> = {
  TEXT_POST: ContentType.TEXT_POST,
  IMAGE_POST: ContentType.IMAGE_POST,
  CAROUSEL: ContentType.CAROUSEL,
  SHORT_VIDEO: ContentType.SHORT_VIDEO,
  LONG_VIDEO: ContentType.LONG_VIDEO,
  THREAD: ContentType.THREAD,
};

type Props = {
  contentId: string;
  brandId: string;
  organisationId: string;
  title: string;
  body: string;
  existingChannels: string[];
  onCreated: () => void;
};

export function ChannelVariantCreator({
  contentId,
  brandId,
  organisationId,
  title,
  body,
  existingChannels,
  onCreated,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const availableChannels = useMemo(
    () => CHANNEL_OPTIONS.filter((channel) => !existingChannels.includes(channel.key)),
    [existingChannels],
  );

  const drafts = useMemo(
    () =>
      buildVariantDraftsFromSource({
        sourceContentId: contentId,
        title,
        body,
        targetProviders: selected,
      }),
    [contentId, title, body, selected],
  );

  function toggleChannel(channel: string) {
    setSelected((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    );
  }

  async function handleCreate() {
    if (selected.length === 0) {
      setError("Select at least one target channel.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const variants = drafts
        .map((draft) => {
          const marketingChannel = PROVIDER_TO_MARKETING_CHANNEL[draft.provider];
          if (!marketingChannel) return null;
          return {
            marketingChannel,
            format: FORMAT_TO_CONTENT_TYPE[draft.format] ?? ContentType.TEXT_POST,
            channelBody: draft.copy,
            caption: draft.hook ?? draft.title,
            headline: draft.title,
          };
        })
        .filter((variant): variant is NonNullable<typeof variant> => variant != null);

      await apiFetch(
        `/api/brands/${brandId}/content-studio/${contentId}?organisationId=${organisationId}`,
        {
          method: "PATCH",
          organisationId,
          body: JSON.stringify({ variants }),
        },
      );
      setSelected([]);
      setPreviewOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel variants.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create channel variants</CardTitle>
        <CardDescription>
          Adapt this content into channel-native variants. Variants enter the approval workflow — they
          are not published automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableChannels.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            Channel variants already exist for all supported core channels.
          </p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Target channels</legend>
            {availableChannels.map((channel) => (
              <label key={channel.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(channel.key)}
                  onChange={() => toggleChannel(channel.key)}
                />
                {channel.label}
              </label>
            ))}
          </fieldset>
        )}

        {selected.length > 0 ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen((open) => !open)}
            >
              {previewOpen ? "Hide preview" : "Preview variants"}
            </Button>
            {previewOpen ? (
              <ul className="space-y-2 rounded-md border border-border p-3 text-sm">
                {drafts.map((draft) => (
                  <li key={`${draft.provider}-${draft.format}`}>
                    <p className="font-medium">
                      {draft.provider} · {draft.format}
                    </p>
                    <p className="mt-1 text-foreground-muted line-clamp-3">{draft.copy}</p>
                    {draft.mediaRequirements && draft.mediaRequirements.length > 0 ? (
                      <p className="mt-1 text-xs text-warning">{draft.mediaRequirements.join(", ")}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button
          type="button"
          variant="organic"
          size="sm"
          disabled={saving || selected.length === 0}
          onClick={() => void handleCreate()}
        >
          Create variants
        </Button>
      </CardContent>
    </Card>
  );
}
