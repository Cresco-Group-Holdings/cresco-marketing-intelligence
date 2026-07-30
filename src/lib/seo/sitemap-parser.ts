export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
};

export type ParsedSitemap = {
  type: "urlset" | "sitemapindex";
  entries: SitemapEntry[];
  childSitemaps: string[];
  errors: string[];
};

const MAX_ENTRIES = 50_000;

function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(re);
  return match?.[1]?.trim();
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(re) ?? [];
}

export function parseSitemapXml(xml: string): ParsedSitemap {
  const errors: string[] = [];
  const trimmed = xml.trim();

  if (!trimmed.includes("<")) {
    return { type: "urlset", entries: [], childSitemaps: [], errors: ["Empty or invalid XML."] };
  }

  const isIndex =
    /<sitemapindex/i.test(trimmed) || extractAllBlocks(trimmed, "sitemap").length > 0;

  if (isIndex) {
    const childSitemaps: string[] = [];
    for (const block of extractAllBlocks(trimmed, "sitemap")) {
      const loc = extractTag(block, "loc");
      if (loc) childSitemaps.push(loc);
    }
    if (childSitemaps.length === 0) {
      errors.push("Sitemap index contained no child sitemaps.");
    }
    return { type: "sitemapindex", entries: [], childSitemaps, errors };
  }

  const entries: SitemapEntry[] = [];
  const urlBlocks = extractAllBlocks(trimmed, "url");

  for (const block of urlBlocks) {
    if (entries.length >= MAX_ENTRIES) {
      errors.push(`Truncated at ${MAX_ENTRIES} URLs.`);
      break;
    }
    const loc = extractTag(block, "loc");
    if (!loc) {
      errors.push("URL entry missing loc.");
      continue;
    }
    const lastmod = extractTag(block, "lastmod");
    const changefreq = extractTag(block, "changefreq");
    const priorityStr = extractTag(block, "priority");
    const priority = priorityStr ? Number(priorityStr) : undefined;
    entries.push({
      loc,
      lastmod,
      changefreq,
      priority: Number.isFinite(priority) ? priority : undefined,
    });
  }

  if (entries.length === 0 && urlBlocks.length === 0) {
    errors.push("No URL entries found in sitemap.");
  }

  return { type: "urlset", entries, childSitemaps: [], errors };
}
