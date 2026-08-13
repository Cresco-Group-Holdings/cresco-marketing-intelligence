import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CAMPAIGN_CHANNEL_LABELS,
  type CampaignChannel,
  type CampaignChannelType,
} from "@/components/campaigns/types";

function channelLabel(channelType: string): string {
  return CAMPAIGN_CHANNEL_LABELS[channelType as CampaignChannelType] ?? channelType.replace(/_/g, " ").toLowerCase();
}

export function CampaignChannelsPanel({ channels }: { channels: CampaignChannel[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channels</CardTitle>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <p className="text-sm text-slate-600">No channels selected for this campaign.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {channels.map((channel) => (
              <div key={channel.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{channelLabel(channel.channelType)}</p>
                  {channel.provider ? (
                    <p className="text-xs text-slate-500">Provider: {channel.provider}</p>
                  ) : null}
                  {channel.notes ? <p className="text-xs text-slate-500">{channel.notes}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{channel.channelType}</Badge>
                  {channel.budgetAmount != null ? (
                    <span className="text-xs text-slate-600">{channel.budgetAmount.toLocaleString()}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
