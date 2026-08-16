import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export type ChannelConnectionState = "connected" | "disconnected" | "error" | "loading";

export type ChannelMetric = {
  label: string;
  value: string;
};

type ChannelCardBaseProps = {
  title: string;
  subtitle?: string;
  metrics: ChannelMetric[];
  connectionState: ChannelConnectionState;
  emptyMessage?: string;
  ctaLabel: string;
  ctaHref: string;
  connectHref?: string;
  connectLabel?: string;
  statusLabel?: string;
  className?: string;
};

function ConnectionBadge({ state }: { state: ChannelConnectionState }) {
  if (state === "loading") {
    return <Badge variant="muted">Checking…</Badge>;
  }
  if (state === "connected") {
    return <Badge variant="success">Connected</Badge>;
  }
  if (state === "error") {
    return <Badge variant="danger">Error</Badge>;
  }
  return <Badge variant="muted">Not connected</Badge>;
}

export function ChannelCard({
  title,
  subtitle,
  metrics,
  connectionState,
  emptyMessage,
  ctaLabel,
  ctaHref,
  connectHref,
  connectLabel = "Connect",
  statusLabel,
  accent = "neutral",
  className,
}: ChannelCardBaseProps & { accent?: "paid" | "organic" | "neutral" }) {
  const isDisconnected = connectionState === "disconnected" || connectionState === "error";

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-border bg-surface-elevated p-5 shadow-sm",
        accent === "paid" && "border-l-4 border-l-paid-accent",
        accent === "organic" && "border-l-4 border-l-organic-accent",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p> : null}
        </div>
        <ConnectionBadge state={connectionState} />
      </div>

      {connectionState === "loading" ? (
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-surface-hover" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-hover" />
        </div>
      ) : isDisconnected ? (
        <p className="mt-4 flex-1 text-sm text-foreground-muted">
          {emptyMessage ?? "Connect this channel to view performance."}
        </p>
      ) : (
        <dl className="mt-4 grid flex-1 gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt className="text-xs uppercase tracking-wide text-foreground-subtle">
                {metric.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {statusLabel ? (
        <p className="mt-3 text-xs text-foreground-subtle">Status: {statusLabel}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {isDisconnected && connectHref ? (
          <ButtonLink href={connectHref} variant="outline" size="sm">
            {connectLabel}
          </ButtonLink>
        ) : (
          <ButtonLink
            href={ctaHref}
            variant={accent === "paid" ? "paid" : accent === "organic" ? "organic" : "primary"}
            size="sm"
          >
            {ctaLabel}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

export function PaidChannelCard(props: Omit<ChannelCardBaseProps, "accent">) {
  return <ChannelCard {...props} accent="paid" />;
}

export function OrganicChannelCard(props: Omit<ChannelCardBaseProps, "accent">) {
  return <ChannelCard {...props} accent="organic" />;
}
