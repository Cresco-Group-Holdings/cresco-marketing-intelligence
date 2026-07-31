/** Per-organisation SEO engine quotas and emergency controls. */
export const SEO_ORG_QUOTAS = {
  maxConcurrentCrawls: 3,
  maxCrawlsPerDay: 20,
  maxPagesPerCrawl: 10_000,
  maxCompetitorCrawlsPerDay: 10,
  maxTrackedKeywordsPerProject: 500,
  maxAiSeoRequestsPerDay: 200,
} as const;

export function isSeoEngineShutdown(): boolean {
  return process.env.SEO_ENGINE_EMERGENCY_SHUTDOWN === "true";
}

export function isAiSeoShutdown(): boolean {
  return process.env.SEO_AI_EMERGENCY_SHUTDOWN === "true";
}

export function getOrgCrawlQuotaOverrides(organisationId: string): Partial<typeof SEO_ORG_QUOTAS> {
  const raw = process.env.SEO_ORG_QUOTA_OVERRIDES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<typeof SEO_ORG_QUOTAS>>;
    return parsed[organisationId] ?? {};
  } catch {
    return {};
  }
}

export function resolveOrgQuota(
  organisationId: string,
  key: keyof typeof SEO_ORG_QUOTAS,
): number {
  const overrides = getOrgCrawlQuotaOverrides(organisationId);
  return overrides[key] ?? SEO_ORG_QUOTAS[key];
}
