export type SearchOpportunity = {
  id: string;
  rule: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  evidence: Record<string, unknown>;
};

export function generateSearchOpportunities(
  rows: Array<{
    query?: string;
    page?: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    previousClicks?: number;
    previousImpressions?: number;
  }>,
): SearchOpportunity[] {
  const opportunities: SearchOpportunity[] = [];

  for (const row of rows) {
    if (row.impressions >= 500 && row.ctr < 0.02) {
      opportunities.push({
        id: `low-ctr:${row.query ?? row.page ?? "unknown"}`,
        rule: "high_impressions_low_ctr",
        title: "High impressions, low CTR",
        description: "This query or page receives visibility but few clicks. Review title tags and meta descriptions.",
        severity: row.impressions >= 2000 ? "high" : "medium",
        evidence: { query: row.query, page: row.page, impressions: row.impressions, ctr: row.ctr },
      });
    }

    if (row.position >= 8 && row.position <= 20 && row.impressions >= 100) {
      opportunities.push({
        id: `near-page-one:${row.query ?? row.page ?? "unknown"}`,
        rule: "near_first_page",
        title: "Near first page",
        description: "Average position is close to page one. Small content or internal linking improvements may help.",
        severity: "medium",
        evidence: { query: row.query, page: row.page, position: row.position, impressions: row.impressions },
      });
    }

    if (row.previousClicks !== undefined && row.previousClicks > 0) {
      const drop = (row.previousClicks - row.clicks) / row.previousClicks;
      if (drop >= 0.25 && row.clicks >= 10) {
        opportunities.push({
          id: `declining-clicks:${row.query ?? row.page ?? "unknown"}`,
          rule: "declining_clicks",
          title: "Declining clicks",
          description: "Clicks have fallen compared to the prior period.",
          severity: drop >= 0.5 ? "high" : "medium",
          evidence: { query: row.query, page: row.page, clicks: row.clicks, previousClicks: row.previousClicks },
        });
      }
    }

    if (row.previousImpressions !== undefined && row.previousImpressions > 0) {
      const gain = (row.impressions - row.previousImpressions) / row.previousImpressions;
      if (gain >= 0.5 && row.impressions >= 50) {
        opportunities.push({
          id: `gaining-impressions:${row.query ?? row.page ?? "unknown"}`,
          rule: "gaining_impressions",
          title: "Gaining impressions",
          description: "Visibility is increasing. Ensure the destination page matches search intent.",
          severity: "low",
          evidence: {
            query: row.query,
            page: row.page,
            impressions: row.impressions,
            previousImpressions: row.previousImpressions,
          },
        });
      }
    }

    if (row.query && !row.page && row.impressions >= 200) {
      opportunities.push({
        id: `query-no-page:${row.query}`,
        rule: "query_without_strong_page",
        title: "Query without a strong destination page",
        description: "This query has visibility but may lack a focused landing page.",
        severity: "medium",
        evidence: { query: row.query, impressions: row.impressions },
      });
    }
  }

  return opportunities;
}
