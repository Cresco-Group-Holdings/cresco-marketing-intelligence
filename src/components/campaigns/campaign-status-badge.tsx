import { Badge } from "@/components/ui/badge";
import {
  CAMPAIGN_STATUS_LABELS,
  type CampaignStatus,
} from "@/components/campaigns/types";

const STATUS_VARIANT: Record<CampaignStatus, "default" | "muted" | "warning"> = {
  DRAFT: "muted",
  PLANNED: "muted",
  ACTIVE: "default",
  PAUSED: "warning",
  COMPLETED: "muted",
  CANCELLED: "muted",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus | string }) {
  const normalized = status as CampaignStatus;
  const label = CAMPAIGN_STATUS_LABELS[normalized] ?? status.replace(/_/g, " ").toLowerCase();
  const variant = STATUS_VARIANT[normalized] ?? "muted";

  return <Badge variant={variant}>{label}</Badge>;
}
