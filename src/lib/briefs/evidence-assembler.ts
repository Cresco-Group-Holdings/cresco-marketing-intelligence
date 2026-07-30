export type BriefEvidenceBundle = {
  keywords: Array<{ keyword: string; intent: string; impressions?: number | null; position?: number | null }>;
  cluster?: { id: string; name: string; memberCount: number };
  targetPage?: { url: string; title?: string; wordCount?: number };
  searchConsole?: { hasData: boolean; note: string };
  competitorEvidence: Array<{ url?: string; type: string; excerpt?: string; observedAt?: string }>;
  serpEvidence: Array<{ query: string; observedAt?: string; hasCurrentData: boolean; note: string }>;
  brandKnowledge: { hasSnapshot: boolean };
  limitations: string[];
};

export function assembleEvidenceLimitations(bundle: BriefEvidenceBundle): string[] {
  const limitations = [...bundle.limitations];
  if (!bundle.searchConsole?.hasData) {
    limitations.push("No Search Console metrics available for this keyword.");
  }
  if (bundle.serpEvidence.every((s) => !s.hasCurrentData)) {
    limitations.push("No current SERP observation data — do not claim live SERP analysis.");
  }
  if (bundle.competitorEvidence.length === 0) {
    limitations.push("No competitor evidence attached — gap analysis may be incomplete.");
  }
  if (!bundle.brandKnowledge.hasSnapshot) {
    limitations.push("Limited Brand Knowledge context available.");
  }
  return limitations;
}
