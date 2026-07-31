export type MergeConflict = {
  field: string;
  sourceValue: unknown;
  destinationValue: unknown;
};

export type MergePreview = {
  sourceRecordId: string;
  destinationRecordId: string;
  conflicts: MergeConflict[];
  activitiesToMigrate: number;
  consentStrategy: string;
  attributionPreserved: boolean;
};

export type ConsentRecord = {
  channel: string;
  granted: boolean;
  lawfulBasis?: string;
};

export function previewMergeConflicts(
  source: Record<string, unknown>,
  destination: Record<string, unknown>,
  fields: string[],
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  for (const field of fields) {
    const sv = source[field];
    const dv = destination[field];
    if (sv !== undefined && dv !== undefined && sv !== dv && sv !== null && dv !== null) {
      conflicts.push({ field, sourceValue: sv, destinationValue: dv });
    }
  }
  return conflicts;
}

export function resolveConsentOnMerge(source: ConsentRecord[], destination: ConsentRecord[]): ConsentRecord[] {
  const merged = new Map<string, ConsentRecord>();
  for (const c of [...destination, ...source]) {
    const existing = merged.get(c.channel);
    if (!existing) {
      merged.set(c.channel, c);
    } else {
      merged.set(c.channel, {
        channel: c.channel,
        granted: existing.granted && c.granted,
        lawfulBasis: existing.lawfulBasis ?? c.lawfulBasis,
      });
    }
  }
  return Array.from(merged.values());
}

export function buildMergePreview(
  sourceId: string,
  destId: string,
  source: Record<string, unknown>,
  destination: Record<string, unknown>,
  activityCount: number,
): MergePreview {
  return {
    sourceRecordId: sourceId,
    destinationRecordId: destId,
    conflicts: previewMergeConflicts(source, destination, ["email", "phone", "status", "lifecycleStage", "ownerUserId"]),
    activitiesToMigrate: activityCount,
    consentStrategy: "Most restrictive valid consent prevails until reviewed.",
    attributionPreserved: true,
  };
}
