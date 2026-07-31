const counters = new Map<string, number>();

export function incrementCrmCounter(name: string, delta = 1) {
  counters.set(name, (counters.get(name) ?? 0) + delta);
}

export function getCrmMetricsSnapshot() {
  return { counters: Object.fromEntries(counters), timestamp: new Date().toISOString() };
}

export function resetCrmCounters() {
  counters.clear();
}

export const CRM_METRIC_NAMES = {
  leadsCreated: "leads_created",
  duplicateRate: "duplicate_candidates_created",
  mergeRate: "merge_operations_completed",
  failedImports: "failed_imports",
  identityConflicts: "identity_conflicts",
  orphanIdentities: "orphan_identities",
  unassignedLeads: "unassigned_leads",
  staleLeads: "stale_leads",
  permissionDenials: "permission_denials",
  exportVolume: "export_volume",
  deletionFailures: "deletion_failures",
} as const;
