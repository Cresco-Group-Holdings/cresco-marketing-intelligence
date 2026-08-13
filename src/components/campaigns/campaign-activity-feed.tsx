import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignActivity } from "@/components/campaigns/types";

export function CampaignActivityFeed({ activities }: { activities: CampaignActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-slate-600">No activity recorded yet.</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-900">{activity.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {activity.actor.displayName ?? activity.actor.email} ·{" "}
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
