import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CampaignMember } from "@/components/campaigns/types";

export function CampaignTeamPanel({ members }: { members: CampaignMember[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length === 0 ? (
          <p className="text-sm text-foreground-muted">No team members assigned yet.</p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {member.user.displayName ?? member.user.email}
                </p>
                <p className="text-xs text-foreground-subtle">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {member.role ? <Badge variant="muted">{member.role}</Badge> : null}
                <span className="text-xs text-foreground-subtle">
                  Added {new Date(member.addedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
