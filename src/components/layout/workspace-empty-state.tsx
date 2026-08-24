import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Link2, Megaphone, Share2, BarChart3, Sparkles } from "lucide-react";

export function PaidEmptyState() {
  return (
    <EmptyState
      icon={<Megaphone className="h-6 w-6" aria-hidden="true" />}
      title="No paid advertising accounts connected"
      description="Connect Google Ads, Meta Ads, TikTok Ads or LinkedIn Ads to start tracking paid performance."
      action={
        <ButtonLink href="/connectors" variant="paid" size="sm">
          Connect account
        </ButtonLink>
      }
    />
  );
}

export function OrganicEmptyState() {
  return (
    <EmptyState
      icon={<Share2 className="h-6 w-6" aria-hidden="true" />}
      title="Connect your social channels"
      description="Publish and measure Instagram, TikTok, YouTube, LinkedIn and Facebook from Cresco."
      action={
        <ButtonLink href="/organic-social/accounts" variant="organic" size="sm">
          Connect channel
        </ButtonLink>
      }
    />
  );
}

export function ReelsEmptyState() {
  return (
    <EmptyState
      icon={<Share2 className="h-6 w-6" aria-hidden="true" />}
      title="No Reels or Shorts yet"
      description="Create a short-form video or repurpose existing content."
      action={
        <ButtonLink href="/content/studio/new?format=short_video" variant="organic" size="sm">
          Create content
        </ButtonLink>
      }
    />
  );
}

export function AnalyticsEmptyState() {
  return (
    <EmptyState
      icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
      title="Not enough data for unified analytics"
      description="Connect marketing, conversion and revenue sources to understand cross-channel performance."
      action={
        <ButtonLink href="/connectors" variant="outline" size="sm">
          Review connections
        </ButtonLink>
      }
    />
  );
}

export function CopilotEmptyState() {
  return (
    <EmptyState
      icon={<Sparkles className="h-6 w-6 text-ai-accent" aria-hidden="true" />}
      title="Ask Cresco about your marketing"
      description="Once data sources are connected, Cresco can analyse performance, content, attribution and revenue."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/connectors" variant="outline" size="sm">
            Review connections
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="ghost" size="sm">
            Open Marketing Command Centre
          </ButtonLink>
        </div>
      }
    />
  );
}

export function WorkspaceErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<Link2 className="h-6 w-6" aria-hidden="true" />}
      title={title}
      description={description ?? "Your data has not been changed."}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface-elevated px-4 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            Retry
          </button>
        ) : null
      }
      className="border-danger/20 bg-danger-muted/20"
    />
  );
}
