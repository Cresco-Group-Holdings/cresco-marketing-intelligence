import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CampaignEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function CampaignEmptyState({
  title,
  description,
  actionLabel = "New campaign",
  actionHref = "/campaigns/new",
}: CampaignEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 py-12">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="max-w-xl text-sm text-foreground-muted">{description}</p>
        </div>
        {actionHref ? (
          <ButtonLink href={actionHref}>{actionLabel}</ButtonLink>
        ) : null}
      </CardContent>
    </Card>
  );
}
