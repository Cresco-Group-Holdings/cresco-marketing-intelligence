export type ExtractedHeading = { level: number; text: string; selector?: string };

export type ExtractedLink = {
  href: string;
  anchorText: string;
  rel?: string;
  isImageLink: boolean;
};

export type ExtractedImage = { src: string; alt?: string };

export type ExtractedStructuredData = {
  format: "json-ld" | "microdata" | "rdfa";
  schemaType: string;
  content: unknown;
  raw: string;
};

export type HtmlExtraction = {
  title?: string;
  description?: string;
  metaRobots?: string;
  canonical?: string;
  hreflang: Array<{ lang: string; href: string }>;
  headings: ExtractedHeading[];
  textLength: number;
  mainContentApprox?: string;
  internalLinks: ExtractedLink[];
  externalLinks: ExtractedLink[];
  images: ExtractedImage[];
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  lang?: string;
  viewport?: string;
  favicon?: string;
  paginationLinks: string[];
  structuredData: ExtractedStructuredData[];
  forms: number;
  scripts: number;
  stylesheets: number;
};

function extractMeta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
    "i",
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1];
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim().replace(/\s+/g, " ");
}

function extractCanonical(html: string): string | undefined {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const alt = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return match?.[1] ?? alt?.[1];
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(html: string): ExtractedHeading[] {
  const headings: ExtractedHeading[] = [];
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]);
    const text = stripTags(match[2] ?? "").slice(0, 500);
    if (text) headings.push({ level, text });
  }
  return headings;
}

function extractLinks(html: string, baseUrl: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const re = /<a\s+([^>]*?)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href.startsWith("#") || href.startsWith("javascript:")) continue;
    const relMatch = attrs.match(/rel=["']([^"']+)["']/i);
    const isImageLink = /<img/i.test(attrs);
    let anchorText = "";
    const closeIdx = html.indexOf("</a>", match.index);
    if (closeIdx > match.index) {
      anchorText = stripTags(html.slice(match.index + match[0].length, closeIdx)).slice(0, 300);
    }
    try {
      const resolved = new URL(href, baseUrl).href;
      links.push({
        href: resolved,
        anchorText,
        rel: relMatch?.[1],
        isImageLink,
      });
    } catch {
      // skip invalid
    }
  }
  return links;
}

function extractImages(html: string, baseUrl: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const re = /<img\s+([^>]*?)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    try {
      images.push({
        src: new URL(srcMatch[1], baseUrl).href,
        alt: altMatch?.[1],
      });
    } catch {
      // skip
    }
  }
  return images;
}

function extractJsonLd(html: string): ExtractedStructuredData[] {
  const items: ExtractedStructuredData[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim() ?? "";
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const schemaType =
        typeof parsed["@type"] === "string"
          ? parsed["@type"]
          : Array.isArray(parsed["@graph"])
            ? "Graph"
            : "Unknown";
      items.push({ format: "json-ld", schemaType, content: parsed, raw: raw.slice(0, 10_000) });
    } catch {
      items.push({ format: "json-ld", schemaType: "Invalid", content: null, raw: raw.slice(0, 500) });
    }
  }
  return items;
}

function extractHreflang(html: string): Array<{ lang: string; href: string }> {
  const items: Array<{ lang: string; href: string }> = [];
  const re = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    if (!/hreflang/i.test(tag)) continue;
    const lang = tag.match(/hreflang=["']([^"']+)["']/i)?.[1];
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (lang && href) items.push({ lang, href });
  }
  return items;
}

function countTags(html: string, tag: string): number {
  const re = new RegExp(`<${tag}[\\s>]`, "gi");
  return (html.match(re) ?? []).length;
}

export function extractHtml(
  html: string,
  baseUrl: string,
  siteHostname: string,
): HtmlExtraction {
  const title = extractTitle(html);
  const description = extractMeta(html, "description");
  const metaRobots = extractMeta(html, "robots");
  const canonical = extractCanonical(html);
  const hreflang = extractHreflang(html);
  const headings = extractHeadings(html);
  const allLinks = extractLinks(html, baseUrl);
  const internalLinks: ExtractedLink[] = [];
  const externalLinks: ExtractedLink[] = [];

  for (const link of allLinks) {
    try {
      const host = new URL(link.href).hostname;
      if (host === siteHostname || host.endsWith(`.${siteHostname}`)) {
        internalLinks.push(link);
      } else {
        externalLinks.push(link);
      }
    } catch {
      externalLinks.push(link);
    }
  }

  const images = extractImages(html, baseUrl);
  const structuredData = extractJsonLd(html);
  const text = stripTags(html);

  const openGraph: Record<string, string> = {};
  const ogRe = /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  let ogMatch: RegExpExecArray | null;
  while ((ogMatch = ogRe.exec(html)) !== null) {
    openGraph[`og:${ogMatch[1]}`] = ogMatch[2] ?? "";
  }

  const twitterCard: Record<string, string> = {};
  const twRe = /<meta[^>]+name=["']twitter:([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  let twMatch: RegExpExecArray | null;
  while ((twMatch = twRe.exec(html)) !== null) {
    twitterCard[`twitter:${twMatch[1]}`] = twMatch[2] ?? "";
  }

  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const viewport = extractMeta(html, "viewport");
  const favicon =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)?.[1];

  const paginationLinks: string[] = [];
  const pagRe = /<link[^>]+rel=["'](?:next|prev)["'][^>]+href=["']([^"']+)["']/gi;
  let pagMatch: RegExpExecArray | null;
  while ((pagMatch = pagRe.exec(html)) !== null) {
    if (pagMatch[1]) paginationLinks.push(pagMatch[1]);
  }

  return {
    title,
    description,
    metaRobots,
    canonical,
    hreflang,
    headings,
    textLength: text.length,
    mainContentApprox: text.slice(0, 2000),
    internalLinks,
    externalLinks,
    images,
    openGraph,
    twitterCard,
    lang: langMatch?.[1],
    viewport,
    favicon,
    paginationLinks,
    structuredData,
    forms: countTags(html, "form"),
    scripts: countTags(html, "script"),
    stylesheets: countTags(html, "link"),
  };
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
