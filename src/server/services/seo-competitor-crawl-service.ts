import { createHash } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import {
  assertCompetitorUrlAllowed,
  getCompetitorCrawlPolicy,
  isBlockedCrawlPath,
  truncateExcerpt,
} from "@/lib/competitors/crawl-policy";
import { extractHtml, wordCount } from "@/lib/seo/html-extractor";
import { isPathAllowed, parseRobotsTxt } from "@/lib/seo/robots-parser";
import { validateCrawlUrl } from "@/lib/seo/ssrf-guard";
import { normaliseUrl } from "@/lib/seo/url-normalisation";
import type { TenantContext } from "@/lib/tenancy/context";
import { seoCompetitorService } from "@/server/services/seo-competitor-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

type FetchResult = {
  finalUrl: string;
  statusCode: number;
  body?: string;
  contentType?: string;
};

async function safeFetch(
  url: string,
  allowedHostnames: string[],
  options: {
    userAgent: string;
    requestTimeoutMs: number;
    redirectLimit: number;
    maxContentBytes: number;
  },
): Promise<FetchResult> {
  let currentUrl = url;
  for (let hop = 0; hop <= options.redirectLimit; hop++) {
    const validation = validateCrawlUrl(currentUrl, allowedHostnames, true);
    if (!validation.allowed) {
      throw new AppError("FORBIDDEN", validation.reason);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.requestTimeoutMs);
    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": options.userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop >= options.redirectLimit) {
          return { finalUrl: currentUrl, statusCode: response.status };
        }
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      const contentType = response.headers.get("content-type") ?? undefined;
      let body: string | undefined;
      if (contentType?.includes("text/html") || contentType?.includes("application/xhtml")) {
        const buffer = await response.arrayBuffer();
        body = new TextDecoder().decode(
          buffer.byteLength > options.maxContentBytes ? buffer.slice(0, options.maxContentBytes) : buffer,
        );
      }

      return { finalUrl: currentUrl, statusCode: response.status, body, contentType };
    } finally {
      clearTimeout(timer);
    }
  }

  return { finalUrl: currentUrl, statusCode: 0 };
}

function inferContentType(path: string, headings: Array<{ level: number; text: string }>): string {
  const lower = path.toLowerCase();
  if (lower.includes("/blog") || lower.includes("/article")) return "blog";
  if (lower.includes("/faq")) return "faq";
  if (lower.includes("/glossary")) return "glossary";
  if (lower.includes("/pricing")) return "pricing";
  if (lower.includes("/product")) return "product";
  if (headings.some((h) => h.level === 1 && /faq/i.test(h.text))) return "faq";
  return "page";
}

function detectTopicsFromHeadings(headings: Array<{ level: number; text: string }>): string[] {
  return headings
    .filter((h) => h.level <= 2)
    .map((h) => h.text.trim())
    .filter((t) => t.length > 2 && t.length < 120)
    .slice(0, 10);
}

function inferCtaType(html: string): string | undefined {
  if (/type=["']submit["']/i.test(html) && /newsletter|subscribe/i.test(html)) return "newsletter";
  if (/book\s+(a\s+)?demo|schedule\s+(a\s+)?call/i.test(html)) return "demo";
  if (/get\s+started|sign\s+up|start\s+free/i.test(html)) return "signup";
  if (/contact\s+us|get\s+in\s+touch/i.test(html)) return "contact";
  return undefined;
}

export const seoCompetitorCrawlService = {
  async startCrawl(
    competitorId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    idempotencyKey?: string,
  ) {
    const competitor = await seoCompetitorService.getById(competitorId, brandId, organisationId, context);
    if (competitor.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot crawl an archived competitor.");
    }

    const key = idempotencyKey ?? `competitor-crawl:${competitorId}:${Date.now()}`;
    const existing = await prisma.seoCompetitorSnapshot.findUnique({ where: { idempotencyKey: key } });
    if (existing) return existing;

    const snapshot = await prisma.seoCompetitorSnapshot.create({
      data: {
        organisationId,
        competitorId,
        status: "QUEUED",
        idempotencyKey: key,
      },
    });

    void this.executeCrawl(snapshot.id).catch((error) => {
      logger.error("competitor crawl failed", { snapshotId: snapshot.id, error });
    });

    return snapshot;
  },

  async executeCrawl(snapshotId: string) {
    const snapshot = await prisma.seoCompetitorSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        competitor: { include: { domains: true } },
      },
    });
    if (!snapshot) throw new AppError("NOT_FOUND", "Snapshot not found.");
    if (snapshot.competitor.status === "ARCHIVED") {
      await prisma.seoCompetitorSnapshot.update({
        where: { id: snapshotId },
        data: { status: "BLOCKED", lastError: "Competitor is archived.", completedAt: new Date() },
      });
      return;
    }

    const policy = getCompetitorCrawlPolicy();
    const hostnames = snapshot.competitor.domains.map((d) => d.hostname);
    const primary = snapshot.competitor.domains.find((d) => d.isPrimary) ?? snapshot.competitor.domains[0];
    if (!primary) {
      await prisma.seoCompetitorSnapshot.update({
        where: { id: snapshotId },
        data: { status: "FAILED", lastError: "No domain configured.", completedAt: new Date() },
      });
      return;
    }

    await prisma.seoCompetitorSnapshot.update({
      where: { id: snapshotId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    let robotsRules = null as ReturnType<typeof parseRobotsTxt> | null;
    if (policy.respectRobotsTxt) {
      try {
        const robotsUrl = `https://${primary.hostname}/robots.txt`;
        assertCompetitorUrlAllowed(robotsUrl, hostnames);
        const robotsRes = await safeFetch(robotsUrl, hostnames, policy);
        if (robotsRes.body) robotsRules = parseRobotsTxt(robotsRes.body);
      } catch {
        // proceed without robots if unreachable
      }
    }

    const queue: Array<{ url: string; depth: number }> = [{ url: `https://${primary.hostname}/`, depth: 0 }];
    const visited = new Set<string>();
    let pagesDiscovered = 0;
    let pagesCrawled = 0;
    let pagesBlocked = 0;
    const topicCounts = new Map<string, number>();

    while (queue.length > 0 && pagesCrawled < policy.maxPages) {
      const item = queue.shift()!;
      const normalised = normaliseUrl(item.url).normalised;
      if (visited.has(normalised)) continue;
      visited.add(normalised);
      pagesDiscovered++;

      try {
        const parsed = new URL(item.url);
        if (isBlockedCrawlPath(parsed.pathname)) {
          pagesBlocked++;
          continue;
        }
        if (robotsRules && !isPathAllowed(robotsRules, parsed.pathname, policy.userAgent).allowed) {
          pagesBlocked++;
          await prisma.seoCompetitorEvidence.create({
            data: {
              organisationId: snapshot.organisationId,
              snapshotId,
              evidenceType: "robots_blocked",
              url: item.url,
              metadata: { path: parsed.pathname },
            },
          });
          continue;
        }

        assertCompetitorUrlAllowed(item.url, hostnames);
        const result = await safeFetch(item.url, hostnames, policy);
        if (!result.body || result.statusCode >= 400) {
          pagesBlocked++;
          continue;
        }

        const extracted = extractHtml(result.body, result.finalUrl, primary.hostname);
        const headings = extracted.headings.map((h) => ({ level: h.level, text: h.text }));
        const wc = wordCount(extracted.mainContentApprox ?? result.body);
        const contentHash = digest(result.body);
        const topics = detectTopicsFromHeadings(headings);
        const contentType = inferContentType(parsed.pathname, headings);
        const structuredTypes = extracted.structuredData.map((s) => s.schemaType);
        const internalLinkCount = extracted.internalLinks.length;

        const existing = await prisma.seoCompetitorPage.findUnique({
          where: {
            competitorId_normalisedUrl: {
              competitorId: snapshot.competitorId,
              normalisedUrl: normalised,
            },
          },
        });

        const page = await prisma.seoCompetitorPage.upsert({
          where: {
            competitorId_normalisedUrl: {
              competitorId: snapshot.competitorId,
              normalisedUrl: normalised,
            },
          },
          create: {
            organisationId: snapshot.organisationId,
            competitorId: snapshot.competitorId,
            snapshotId,
            url: result.finalUrl,
            normalisedUrl: normalised,
            statusCode: result.statusCode,
            title: extracted.title,
            description: extracted.description,
            canonicalUrl: extracted.canonical,
            headings,
            wordCount: wc,
            structuredData: structuredTypes,
            internalLinkCount,
            detectedTopics: topics,
            contentType,
            contentHash,
            ctaType: inferCtaType(result.body),
          },
          update: {
            snapshotId,
            url: result.finalUrl,
            statusCode: result.statusCode,
            title: extracted.title,
            description: extracted.description,
            canonicalUrl: extracted.canonical,
            headings,
            wordCount: wc,
            structuredData: structuredTypes,
            internalLinkCount,
            detectedTopics: topics,
            contentType,
            contentHash,
            ctaType: inferCtaType(result.body),
            previousHash: existing?.contentHash ?? undefined,
            changedAt: existing && existing.contentHash !== contentHash ? new Date() : existing?.changedAt,
            observedAt: new Date(),
          },
        });

        await prisma.seoCompetitorEvidence.create({
          data: {
            organisationId: snapshot.organisationId,
            snapshotId,
            pageId: page.id,
            evidenceType: "page_crawl",
            url: result.finalUrl,
            excerpt: truncateExcerpt(extracted.title ?? ""),
            metadata: { statusCode: result.statusCode, wordCount: wc, contentType },
          },
        });

        for (const topic of topics) {
          topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
        }

        pagesCrawled++;

        if (item.depth < policy.maxDepth) {
          for (const link of extracted.internalLinks) {
            try {
              const linkUrl = new URL(link.href, result.finalUrl).href;
              const linkNorm = normaliseUrl(linkUrl).normalised;
              if (!visited.has(linkNorm) && queue.length + pagesCrawled < policy.maxPages) {
                queue.push({ url: linkUrl, depth: item.depth + 1 });
              }
            } catch {
              // skip invalid links
            }
          }
        }

        if (policy.requestDelayMs > 0) {
          await new Promise((r) => setTimeout(r, policy.requestDelayMs));
        }
      } catch (error) {
        pagesBlocked++;
        logger.warn("competitor page crawl skipped", { url: item.url, error });
      }
    }

    for (const [topic, count] of topicCounts) {
      await prisma.seoCompetitorTopic.upsert({
        where: { competitorId_topic: { competitorId: snapshot.competitorId, topic } },
        create: {
          organisationId: snapshot.organisationId,
          competitorId: snapshot.competitorId,
          topic,
          pageCount: count,
          evidence: { snapshotId },
        },
        update: {
          pageCount: count,
          detectedAt: new Date(),
          evidence: { snapshotId },
        },
      });
    }

    const status = pagesCrawled === 0 ? "FAILED" : pagesBlocked > 0 ? "PARTIAL" : "COMPLETED";
    await prisma.seoCompetitorSnapshot.update({
      where: { id: snapshotId },
      data: {
        status,
        pagesDiscovered,
        pagesCrawled,
        pagesBlocked,
        completedAt: new Date(),
        lastError: pagesCrawled === 0 ? "No pages could be crawled." : null,
      },
    });
  },
};
