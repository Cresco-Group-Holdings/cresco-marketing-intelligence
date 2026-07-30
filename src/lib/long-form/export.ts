import { createHash } from "crypto";

export type ExportSection = {
  id: string;
  sortOrder: number;
  heading?: string | null;
  headingLevel?: number;
  blockType: string;
  body: string;
  isLocked?: boolean;
};

export type ExportDocument = {
  id: string;
  title?: string | null;
  slug?: string | null;
  metaDescription?: string | null;
  contentType: string;
  status: string;
  sections: ExportSection[];
  citations?: Array<{ label: string; url?: string | null }>;
};

export type CmsAdapterPayload = {
  adapter: "generic";
  version: "1.0";
  document: {
    title: string;
    slug: string;
    metaDescription?: string;
    contentType: string;
    blocks: Array<{
      type: string;
      content: string;
      heading?: string;
      headingLevel?: number;
      sortOrder: number;
    }>;
    citations: Array<{ label: string; url?: string }>;
  };
  publishReady: false;
  note: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportToHtml(doc: ExportDocument): string {
  const parts: string[] = ["<!DOCTYPE html>", "<html><head>"];
  if (doc.title) parts.push(`<title>${escapeHtml(doc.title)}</title>`);
  if (doc.metaDescription) {
    parts.push(`<meta name="description" content="${escapeHtml(doc.metaDescription)}">`);
  }
  parts.push("</head><body>");
  if (doc.title) parts.push(`<h1>${escapeHtml(doc.title)}</h1>`);

  for (const section of doc.sections.sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (section.heading) {
      const level = section.headingLevel ?? 2;
      parts.push(`<h${level}>${escapeHtml(section.heading)}</h${level}>`);
    }
    if (section.blockType === "LIST") {
      const items = section.body.split("\n").filter(Boolean);
      parts.push("<ul>", ...items.map((i) => `<li>${escapeHtml(i)}</li>`), "</ul>");
    } else if (section.blockType === "QUOTE") {
      parts.push(`<blockquote>${escapeHtml(section.body)}</blockquote>`);
    } else if (section.blockType === "CTA") {
      parts.push(`<div class="cta">${escapeHtml(section.body)}</div>`);
    } else {
      parts.push(`<p>${escapeHtml(section.body)}</p>`);
    }
  }

  if (doc.citations?.length) {
    parts.push("<section class=\"references\"><h2>References</h2><ul>");
    for (const c of doc.citations) {
      if (c.url) {
        parts.push(`<li><a href="${escapeHtml(c.url)}">${escapeHtml(c.label)}</a></li>`);
      } else {
        parts.push(`<li>${escapeHtml(c.label)}</li>`);
      }
    }
    parts.push("</ul></section>");
  }

  parts.push("</body></html>");
  return parts.join("\n");
}

export function exportToMarkdown(doc: ExportDocument): string {
  const parts: string[] = [];
  if (doc.title) parts.push(`# ${doc.title}`, "");
  if (doc.metaDescription) parts.push(`> ${doc.metaDescription}`, "");

  for (const section of doc.sections.sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (section.heading) {
      const level = "#".repeat(Math.min(section.headingLevel ?? 2, 6));
      parts.push(`${level} ${section.heading}`, "");
    }
    if (section.blockType === "LIST") {
      parts.push(...section.body.split("\n").filter(Boolean).map((i) => `- ${i}`), "");
    } else {
      parts.push(section.body, "");
    }
  }

  if (doc.citations?.length) {
    parts.push("## References", "");
    for (const c of doc.citations) {
      parts.push(c.url ? `- [${c.label}](${c.url})` : `- ${c.label}`);
    }
  }

  return parts.join("\n");
}

export function exportToJson(doc: ExportDocument): Record<string, unknown> {
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    metaDescription: doc.metaDescription,
    contentType: doc.contentType,
    status: doc.status,
    sections: doc.sections,
    citations: doc.citations ?? [],
    exportedAt: new Date().toISOString(),
    publishReady: false,
  };
}

export function exportToCmsPayload(doc: ExportDocument): CmsAdapterPayload {
  return {
    adapter: "generic",
    version: "1.0",
    document: {
      title: doc.title ?? "Untitled",
      slug: doc.slug ?? doc.id,
      metaDescription: doc.metaDescription ?? undefined,
      contentType: doc.contentType,
      blocks: doc.sections
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          type: s.blockType.toLowerCase(),
          content: s.body,
          heading: s.heading ?? undefined,
          headingLevel: s.headingLevel,
          sortOrder: s.sortOrder,
        })),
      citations: (doc.citations ?? []).map((c) => ({
        label: c.label,
        url: c.url ?? undefined,
      })),
    },
    publishReady: false,
    note: "CMS adapter extension point — manual publish required.",
  };
}

export function exportToCopyText(doc: ExportDocument): string {
  return exportToMarkdown(doc);
}

export function exportToHandoff(doc: ExportDocument): Record<string, unknown> {
  return {
    handoffVersion: "1.0",
    document: exportToJson(doc),
    html: exportToHtml(doc),
    markdown: exportToMarkdown(doc),
    cmsPayload: exportToCmsPayload(doc),
    instructions: [
      "Review all claims and citations before publishing.",
      "No automatic publishing — hand off to CMS or content team.",
    ],
  };
}

export function checksumPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
