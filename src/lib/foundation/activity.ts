const AUDIT_ACTION_LABELS: Record<string, string> = {
  "organisation.created": "Workspace created",
  "project.created": "Project created",
  "brand.created": "Brand created",
  "brand.updated": "Brand updated",
  "brand.profile.updated": "Brand profile completed",
  "brandKnowledge.updated": "Brand knowledge updated",
  "marketingAsset.uploaded": "Asset uploaded",
  "marketingAsset.updated": "Asset updated",
  "marketingAsset.archived": "Asset archived",
  "member.invited": "Member invited",
  "member.joined": "Member joined",
  "connector.connect.begin": "Connector connection started",
  "connector.connect.complete": "Connector configured",
  "connector.disconnect": "Connector disconnected",
  "connector.reconnect": "Connector reconnected",
  "social.connectionStarted": "Social connection started",
  "social.connectionCompleted": "Social connection completed",
  "social.connectionFailed": "Social connection failed",
  "social.connectionReauthorised": "Social connection reauthorised",
  "social.connectionDisconnected": "Social connection disconnected",
  "social.accountAssigned": "Social account assigned",
  "social.permissionsChanged": "Social permissions changed",
  "content.created": "Content created",
  "content.updated": "Content updated",
  "content.submittedForReview": "Content submitted for review",
  "content.approved": "Content approved",
  "content.changesRequested": "Content changes requested",
  "content.archived": "Content archived",
  "content.revisionRestored": "Content revision restored",
  "content.commentAdded": "Content comment added",
  "content.workflowSettingsUpdated": "Content workflow settings updated",
  "onboarding.completed": "Onboarding completed",
};

export function formatAuditActivityLabel(action: string, resourceType: string): string {
  if (AUDIT_ACTION_LABELS[action]) {
    return AUDIT_ACTION_LABELS[action];
  }

  if (action.includes("brand")) {
    return "Brand updated";
  }
  if (action.includes("asset") || action.includes("marketingAsset")) {
    return "Asset uploaded";
  }
  if (action.includes("connector")) {
    return "Connector configured";
  }
  if (action.includes("member") || action.includes("invitation")) {
    return "Member invited";
  }
  if (action.includes("profile")) {
    return "Profile completed";
  }

  return `${resourceType} · ${action}`;
}

export function isFoundationAuditAction(action: string): boolean {
  const keywords = [
    "organisation",
    "project",
    "brand",
    "asset",
    "marketingAsset",
    "member",
    "invitation",
    "connector",
    "social",
    "content",
    "onboarding",
    "profile",
    "knowledge",
  ];
  return keywords.some((keyword) => action.toLowerCase().includes(keyword));
}
