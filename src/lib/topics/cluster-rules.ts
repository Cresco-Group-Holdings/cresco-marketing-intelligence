import type { SeoKeywordIntentType } from "@prisma/client";

export type ClusterKeywordInput = {
  id: string;
  keyword: string;
  normalisedKeyword: string;
  primaryIntent: SeoKeywordIntentType;
  entities: Array<{ entityType: string; canonicalValue: string }>;
  impressions?: number | null;
  isLocked?: boolean;
  existingClusterId?: string;
};

export type ProposedCluster = {
  name: string;
  slug: string;
  keywordIds: string[];
  confidence: number;
  evidence: Record<string, unknown>;
  namingSource: "deterministic" | "semantic" | "ai";
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function sharedEntityKey(a: ClusterKeywordInput, b: ClusterKeywordInput): boolean {
  for (const ea of a.entities) {
    for (const eb of b.entities) {
      if (
        ea.entityType === eb.entityType &&
        ea.canonicalValue.toLowerCase() === eb.canonicalValue.toLowerCase()
      ) {
        return true;
      }
    }
  }
  return false;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

/** Deterministic clustering by shared entities and intent, with semantic token overlap extension. */
export function buildDeterministicClusters(keywords: ClusterKeywordInput[]): ProposedCluster[] {
  const unlocked = keywords.filter((k) => !k.isLocked);
  const lockedByCluster = new Map<string, string[]>();
  for (const k of keywords.filter((k) => k.isLocked && k.existingClusterId)) {
    const list = lockedByCluster.get(k.existingClusterId!) ?? [];
    list.push(k.id);
    lockedByCluster.set(k.existingClusterId!, list);
  }

  const assigned = new Set<string>();
  for (const ids of lockedByCluster.values()) ids.forEach((id) => assigned.add(id));

  const clusters: ProposedCluster[] = [];

  for (const [clusterId, keywordIds] of lockedByCluster) {
    const sample = keywords.find((k) => k.id === keywordIds[0]);
    clusters.push({
      name: sample?.keyword ?? `Cluster ${clusterId.slice(0, 6)}`,
      slug: slugify(sample?.keyword ?? clusterId),
      keywordIds,
      confidence: 1,
      evidence: { preservedLocked: true, clusterId },
      namingSource: "deterministic",
    });
  }

  const remaining = unlocked.filter((k) => !assigned.has(k.id));
  const groups: ClusterKeywordInput[][] = [];

  for (const kw of remaining) {
    let placed = false;
    for (const group of groups) {
      const anchor = group[0];
      const entityMatch = sharedEntityKey(kw, anchor);
      const intentMatch = kw.primaryIntent === anchor.primaryIntent && kw.primaryIntent !== "UNKNOWN";
      const semanticMatch = tokenOverlap(kw.normalisedKeyword, anchor.normalisedKeyword) >= 0.5;
      if (entityMatch || (intentMatch && semanticMatch) || semanticMatch) {
        group.push(kw);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([kw]);
  }

  for (const group of groups) {
    if (group.length === 0) continue;
    const primary = group.reduce((best, k) =>
      (k.impressions ?? 0) > (best.impressions ?? 0) ? k : best,
    group[0]);
    const entityLabels = [...new Set(group.flatMap((k) => k.entities.map((e) => e.canonicalValue)))].slice(0, 3);
    const name = entityLabels.length > 0 ? entityLabels.join(" / ") : primary.keyword;
    clusters.push({
      name,
      slug: slugify(name),
      keywordIds: group.map((k) => k.id),
      confidence: Math.min(0.95, 0.5 + group.length * 0.05),
      evidence: {
        keywordCount: group.length,
        sharedEntities: entityLabels,
        primaryIntent: primary.primaryIntent,
        rule: "entity_intent_semantic",
      },
      namingSource: group.some((k) => tokenOverlap(k.normalisedKeyword, primary.normalisedKeyword) >= 0.5 && !sharedEntityKey(k, primary))
        ? "semantic"
        : "deterministic",
    });
  }

  return clusters;
}
