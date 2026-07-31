import { createHash, randomUUID } from "node:crypto";
import {
  Prisma,
  SeoCrawlQueueItemStatus,
  SeoCrawlRunStatus,
  SeoLinkType,
  type SeoCrawlRun,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { getSeoCrawlConfig } from "@/lib/seo/config";
import { extractHtml, wordCount } from "@/lib/seo/html-extractor";
import {
  evaluatePageRules,
  findDuplicateContentHashes,
  SEO_ISSUE_DEFINITIONS,
} from "@/lib/seo/issue-rules";
import { incrementSeoCounter } from "@/lib/seo/observability";
import { sanitiseCrawlCustomHeaders } from "@/lib/seo/custom-headers";
import { isPathIncluded } from "@/lib/seo/path-rules";
import { isSeoEngineShutdown, resolveOrgQuota } from "@/lib/seo/quotas";
import { isPathAllowed, parseRobotsTxt } from "@/lib/seo/robots-parser";
import { assertCrawlUrl, validateCrawlUrl } from "@/lib/seo/ssrf-guard";
import { normaliseUrl } from "@/lib/seo/url-normalisation";
import { SEO_PARSER_VERSION } from "@/lib/seo/constants";
import type { TenantContext } from "@/lib/tenancy/context";
import { seoSiteService } from "@/server/services/seo-site-service";
import { brandService } from "@/server/services/workspace-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

type FetchResult = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType?: string;
  contentLength?: number;
  responseTimeMs: number;
  body?: string;
  redirectChain: string[];
  robotsHeader?: string;
  cacheControl?: string;
  etag?: string;
  lastModified?: string;
};

async function safeFetch(
  url: string,
  allowedHostnames: string[],
  allowSubdomains: boolean,
  options: {
    userAgent: string;
    timeoutMs: number;
    redirectLimit: number;
    maxBytes: number;
    customHeaders?: Record<string, string>;
  },
): Promise<FetchResult> {
  const start = Date.now();
  const redirectChain: string[] = [];
  let currentUrl = url;

  for (let hop = 0; hop <= options.redirectLimit; hop++) {
    const validation = validateCrawlUrl(currentUrl, allowedHostnames, allowSubdomains);
    if (!validation.allowed) {
      incrementSeoCounter("ssrf_attempts");
      throw new AppError("FORBIDDEN", validation.reason);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": options.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...options.customHeaders,
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop >= options.redirectLimit) {
          return {
            requestedUrl: url,
            finalUrl: currentUrl,
            statusCode: response.status,
            responseTimeMs: Date.now() - start,
            redirectChain,
          };
        }
        redirectChain.push(currentUrl);
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      const contentType = response.headers.get("content-type") ?? undefined;
      const contentLengthHeader = response.headers.get("content-length");
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

      let body: string | undefined;
      if (contentType?.includes("text/html") || contentType?.includes("application/xhtml")) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > options.maxBytes) {
          incrementSeoCounter("oversized_pages");
          body = new TextDecoder().decode(buffer.slice(0, options.maxBytes));
        } else {
          body = new TextDecoder().decode(buffer);
        }
      }

      return {
        requestedUrl: url,
        finalUrl: currentUrl,
        statusCode: response.status,
        contentType,
        contentLength: contentLength ?? body?.length,
        responseTimeMs: Date.now() - start,
        body,
        redirectChain,
        robotsHeader: response.headers.get("x-robots-tag") ?? undefined,
        cacheControl: response.headers.get("cache-control") ?? undefined,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    requestedUrl: url,
    finalUrl: currentUrl,
    statusCode: 0,
    responseTimeMs: Date.now() - start,
    redirectChain,
  };
}

function classifyLinkType(href: string, siteHostname: string): SeoLinkType {
  if (href.startsWith("mailto:")) return "MAILTO";
  if (href.startsWith("tel:")) return "TELEPHONE";
  try {
    const host = new URL(href).hostname;
    if (host === siteHostname || host.endsWith(`.${siteHostname}`)) return "INTERNAL";
    return "EXTERNAL";
  } catch {
    return "OTHER";
  }
}

async function ensureIssueDefinitions() {
  for (const def of SEO_ISSUE_DEFINITIONS) {
    await prisma.seoIssueDefinition.upsert({
      where: { ruleId: def.ruleId },
      create: {
        ruleId: def.ruleId,
        version: def.version,
        name: def.name,
        description: def.description,
        severity: def.severity,
        category: def.category,
        thresholds: def.thresholds as Prisma.InputJsonValue,
      },
      update: {
        name: def.name,
        description: def.description,
        severity: def.severity,
        category: def.category,
        thresholds: def.thresholds as Prisma.InputJsonValue,
        isActive: true,
      },
    });
  }
}

export const seoCrawlService = {
  async ensureDefinitions() {
    await ensureIssueDefinitions();
  },

  async enqueue(
    siteId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    idempotencyKey?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    if (isSeoEngineShutdown()) {
      throw new AppError("FORBIDDEN", "SEO crawl engine is temporarily disabled.");
    }

    const activeCrawls = await prisma.seoCrawlRun.count({
      where: {
        organisationId,
        status: { in: [SeoCrawlRunStatus.QUEUED, SeoCrawlRunStatus.RUNNING, SeoCrawlRunStatus.PARTIAL] },
      },
    });
    if (activeCrawls >= resolveOrgQuota(organisationId, "maxConcurrentCrawls")) {
      throw new AppError("VALIDATION_ERROR", "Concurrent crawl limit reached for this organisation.");
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const crawlsToday = await prisma.seoCrawlRun.count({
      where: { organisationId, createdAt: { gte: dayStart } },
    });
    if (crawlsToday >= resolveOrgQuota(organisationId, "maxCrawlsPerDay")) {
      throw new AppError("VALIDATION_ERROR", "Daily crawl limit reached for this organisation.");
    }

    const crawlable = await seoSiteService.isSiteCrawlable(siteId);
    if (!crawlable) {
      throw new AppError("FORBIDDEN", "Site must be verified before crawling.");
    }

    const key = idempotencyKey ?? `crawl:${siteId}:${Date.now()}`;
    const existing = await prisma.seoCrawlRun.findUnique({ where: { idempotencyKey: key } });
    if (existing) return existing;

    const site = await prisma.seoSite.findFirst({
      where: { id: siteId, organisationId, brandId },
      include: { crawlConfiguration: true },
    });
    if (!site?.crawlConfiguration) throw new AppError("NOT_FOUND", "Site or config not found.");

    const run = await prisma.seoCrawlRun.create({
      data: {
        organisationId,
        projectId: site.projectId,
        brandId: site.brandId,
        seoSiteId: siteId,
        status: SeoCrawlRunStatus.QUEUED,
        idempotencyKey: key,
        createdByUserId: context.userProfileId,
      },
    });

    const startUrls =
      site.crawlConfiguration.startUrls.length > 0
        ? site.crawlConfiguration.startUrls
        : [`${site.preferredProtocol}://${site.primaryDomain}/`];

    for (const startUrl of startUrls) {
      const normalised = normaliseUrl(startUrl);
      await prisma.seoCrawlQueueItem.create({
        data: {
          organisationId,
          seoSiteId: siteId,
          crawlRunId: run.id,
          url: startUrl,
          normalisedUrl: normalised.normalised,
          depth: 0,
          idempotencyKey: digest(`${run.id}:${normalised.normalised}`),
        },
      });
    }

    incrementSeoCounter("crawls_enqueued");
    return run;
  },

  async cancel(runId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const run = await prisma.seoCrawlRun.findFirst({
      where: { id: runId, organisationId, brandId },
    });
    if (!run) throw new AppError("NOT_FOUND", "Crawl run not found.");
    if (
      run.status === SeoCrawlRunStatus.COMPLETED ||
      run.status === SeoCrawlRunStatus.CANCELLED ||
      run.status === SeoCrawlRunStatus.FAILED
    ) {
      return run;
    }
    return prisma.seoCrawlRun.update({
      where: { id: runId },
      data: { status: SeoCrawlRunStatus.CANCELLED, cancelledAt: new Date(), completedAt: new Date() },
    });
  },

  async getRun(runId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const run = await prisma.seoCrawlRun.findFirst({
      where: { id: runId, organisationId, brandId },
      include: {
        _count: { select: { queueItems: true, snapshots: true, issues: true } },
      },
    });
    if (!run) throw new AppError("NOT_FOUND", "Crawl run not found.");
    return run;
  },

  async listRuns(siteId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoCrawlRun.findMany({
      where: { seoSiteId: siteId, organisationId, brandId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async processDue(limit?: number, workerId?: string) {
    const config = getSeoCrawlConfig();
    const now = new Date();
    const take = Math.min(Math.max(limit ?? config.maxCrawlsPerWorkerRun, 1), 50);

    const due = await prisma.seoCrawlRun.findMany({
      where: {
        OR: [
          {
            status: { in: [SeoCrawlRunStatus.QUEUED, SeoCrawlRunStatus.PARTIAL] },
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          { status: SeoCrawlRunStatus.RUNNING, leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take,
      select: { id: true },
    });

    const results = [];
    for (const item of due) {
      results.push({
        runId: item.id,
        result: await this.process(item.id, workerId ?? `worker-${randomUUID()}`),
      });
    }
    return results;
  },

  async claim(runId: string, workerId: string): Promise<SeoCrawlRun | null> {
    const config = getSeoCrawlConfig();
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + config.leaseDurationMs);

    const updated = await prisma.seoCrawlRun.updateMany({
      where: {
        id: runId,
        OR: [
          { status: { in: [SeoCrawlRunStatus.QUEUED, SeoCrawlRunStatus.PARTIAL] } },
          { status: SeoCrawlRunStatus.RUNNING, leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: SeoCrawlRunStatus.RUNNING,
        workerId,
        leaseExpiresAt: leaseUntil,
        heartbeatAt: now,
        startedAt: now,
        attemptCount: { increment: 1 },
      },
    });

    if (updated.count === 0) return null;
    return prisma.seoCrawlRun.findUnique({ where: { id: runId } });
  },

  async process(runId: string, workerId: string) {
    await ensureIssueDefinitions();
    const run = await this.claim(runId, workerId);
    if (!run) return { status: "SKIPPED" as const };

    const config = getSeoCrawlConfig();
    const site = await prisma.seoSite.findUnique({
      where: { id: run.seoSiteId },
      include: { crawlConfiguration: true, domains: true },
    });
    if (!site?.crawlConfiguration) {
      await this.failRun(runId, "Missing crawl configuration.");
      return { status: "FAILED" as const };
    }

    const crawlConfig = site.crawlConfiguration;
    const allowedHostnames =
      crawlConfig.allowedDomains.length > 0
        ? crawlConfig.allowedDomains
        : [site.primaryDomain];
    const customHeaders = sanitiseCrawlCustomHeaders(
      crawlConfig.customHeaders && typeof crawlConfig.customHeaders === "object"
        ? (crawlConfig.customHeaders as Record<string, string>)
        : undefined,
    );

    let robotsCrawlDelayMs = 0;

    try {
      if (crawlConfig.respectRobotsTxt) {
        const snapshot = await this.fetchRobots(site.id, site.organisationId, allowedHostnames, crawlConfig);
        if (snapshot?.crawlDelay && snapshot.crawlDelay > 0) {
          robotsCrawlDelayMs = snapshot.crawlDelay * 1000;
        }
      }

      const batchSize = config.maxQueueItemsPerBatch;
      let processed = 0;

      while (processed < batchSize) {
        const cancelled = await prisma.seoCrawlRun.findUnique({
          where: { id: runId },
          select: { status: true },
        });
        if (cancelled?.status === SeoCrawlRunStatus.CANCELLED) {
          return { status: "CANCELLED" as const };
        }

        const pending = await prisma.seoCrawlQueueItem.findFirst({
          where: { crawlRunId: runId, status: SeoCrawlQueueItemStatus.PENDING },
          orderBy: { depth: "asc" },
        });
        if (!pending) break;

        if (run.pagesCrawled >= crawlConfig.maxPages) break;

        await prisma.seoCrawlQueueItem.update({
          where: { id: pending.id },
          data: { status: SeoCrawlQueueItemStatus.PROCESSING },
        });

        const result = await this.processQueueItem(
          run,
          site,
          pending,
          allowedHostnames,
          crawlConfig,
          customHeaders,
        );
        processed += 1;

        await prisma.seoCrawlQueueItem.update({
          where: { id: pending.id },
          data: {
            status: result.skipped
              ? SeoCrawlQueueItemStatus.SKIPPED
              : result.failed
                ? SeoCrawlQueueItemStatus.FAILED
                : SeoCrawlQueueItemStatus.COMPLETED,
            processedAt: new Date(),
            lastError: result.error,
          },
        });

        await prisma.seoCrawlRun.update({
          where: { id: runId },
          data: {
            heartbeatAt: new Date(),
            leaseExpiresAt: new Date(Date.now() + config.leaseDurationMs),
            pagesCrawled: { increment: result.crawled ? 1 : 0 },
            pagesBlocked: { increment: result.blocked ? 1 : 0 },
            issuesFound: { increment: result.issuesFound },
          },
        });

        if (crawlConfig.requestDelayMs > 0 || robotsCrawlDelayMs > 0) {
          await new Promise((r) => setTimeout(r, Math.max(crawlConfig.requestDelayMs, robotsCrawlDelayMs)));
        }
      }

      const remaining = await prisma.seoCrawlQueueItem.count({
        where: { crawlRunId: runId, status: SeoCrawlQueueItemStatus.PENDING },
      });

      if (remaining > 0) {
        await prisma.seoCrawlRun.update({
          where: { id: runId },
          data: { status: SeoCrawlRunStatus.PARTIAL, leaseExpiresAt: null, workerId: null },
        });
        return { status: "PARTIAL" as const, remaining };
      }

      await this.finaliseRun(runId, site.id);
      await prisma.seoCrawlRun.update({
        where: { id: runId },
        data: {
          status: SeoCrawlRunStatus.COMPLETED,
          completedAt: new Date(),
          leaseExpiresAt: null,
          workerId: null,
        },
      });
      incrementSeoCounter("crawls_completed");
      return { status: "COMPLETED" as const };
    } catch (error) {
      logger.error("SEO crawl failed", { runId, error });
      incrementSeoCounter("crawl_failures");
      await this.failRun(runId, error instanceof Error ? error.message : "Unknown error");
      return { status: "FAILED" as const };
    }
  },

  async processQueueItem(
    run: SeoCrawlRun,
    site: {
      id: string;
      organisationId: string;
      projectId: string;
      brandId: string;
      primaryDomain: string;
    },
    item: { id: string; url: string; normalisedUrl: string; depth: number },
    allowedHostnames: string[],
    crawlConfig: {
      allowedSubdomains: boolean;
      includeRules: string[];
      excludeRules: string[];
      maxDepth: number;
      userAgent: string;
      requestTimeoutMs: number;
      redirectLimit: number;
      respectRobotsTxt: boolean;
      followCanonical: boolean;
      ignoredExtensions: string[];
      maxPages: number;
    },
    customHeaders?: Record<string, string>,
  ) {
    const ext = crawlConfig.ignoredExtensions.find((e) =>
      item.normalisedUrl.toLowerCase().endsWith(e),
    );
    if (ext) return { skipped: true, crawled: false, blocked: false, failed: false, issuesFound: 0 };

    if (item.depth > crawlConfig.maxDepth) {
      return { skipped: true, crawled: false, blocked: false, failed: false, issuesFound: 0 };
    }

    const pathCheck = isPathIncluded(
      new URL(item.url).pathname,
      crawlConfig.includeRules ?? [],
      crawlConfig.excludeRules ?? [],
    );
    if (!pathCheck.allowed) {
      return { skipped: true, crawled: false, blocked: false, failed: false, issuesFound: 0 };
    }

    try {
      assertCrawlUrl(item.url, allowedHostnames, crawlConfig.allowedSubdomains);
    } catch (error) {
      incrementSeoCounter("ssrf_attempts");
      return {
        skipped: false,
        crawled: false,
        blocked: true,
        failed: true,
        issuesFound: 0,
        error: error instanceof Error ? error.message : "SSRF blocked",
      };
    }

    if (crawlConfig.respectRobotsTxt) {
      const robots = await prisma.seoRobotsSnapshot.findFirst({
        where: { seoSiteId: site.id },
        orderBy: { fetchedAt: "desc" },
      });
      if (robots?.content) {
        const parsed = parseRobotsTxt(robots.content, crawlConfig.userAgent);
        const path = new URL(item.url).pathname;
        const { allowed } = isPathAllowed(parsed, path, crawlConfig.userAgent);
        if (!allowed) {
          incrementSeoCounter("blocked_pages");
          return { skipped: false, crawled: false, blocked: true, failed: false, issuesFound: 0 };
        }
      }
    }

    let fetchResult: FetchResult;
    try {
      fetchResult = await safeFetch(item.url, allowedHostnames, crawlConfig.allowedSubdomains, {
        userAgent: crawlConfig.userAgent,
        timeoutMs: crawlConfig.requestTimeoutMs,
        redirectLimit: crawlConfig.redirectLimit,
        maxBytes: getSeoCrawlConfig().maxContentBytes,
        customHeaders,
      });
    } catch (error) {
      incrementSeoCounter("http_failures");
      return {
        skipped: false,
        crawled: false,
        blocked: false,
        failed: true,
        issuesFound: 0,
        error: error instanceof Error ? error.message : "Fetch failed",
      };
    }

    const contentHash = fetchResult.body ? digest(fetchResult.body) : undefined;
    const extraction = fetchResult.body
      ? extractHtml(fetchResult.body, fetchResult.finalUrl, site.primaryDomain)
      : undefined;

    const page = await prisma.seoCrawlPage.upsert({
      where: { seoSiteId_normalisedUrl: { seoSiteId: site.id, normalisedUrl: item.normalisedUrl } },
      create: {
        organisationId: site.organisationId,
        projectId: site.projectId,
        brandId: site.brandId,
        seoSiteId: site.id,
        normalisedUrl: item.normalisedUrl,
        path: new URL(item.normalisedUrl).pathname,
        lastStatusCode: fetchResult.statusCode,
      },
      update: {
        lastSeenAt: new Date(),
        lastStatusCode: fetchResult.statusCode,
      },
    });

    const snapshot = await prisma.seoPageSnapshot.create({
      data: {
        organisationId: site.organisationId,
        seoSiteId: site.id,
        crawlRunId: run.id,
        pageId: page.id,
        requestedUrl: fetchResult.requestedUrl,
        finalUrl: fetchResult.finalUrl,
        statusCode: fetchResult.statusCode,
        contentType: fetchResult.contentType,
        responseTimeMs: fetchResult.responseTimeMs,
        contentHash,
        title: extraction?.title,
        description: extraction?.description,
        canonicalUrl: extraction?.canonical,
        robotsDirective: extraction?.metaRobots,
        lang: extraction?.lang,
        wordCount: extraction ? wordCount(extraction.mainContentApprox ?? "") : undefined,
        headings: extraction?.headings as Prisma.InputJsonValue,
        openGraph: extraction?.openGraph as Prisma.InputJsonValue,
        twitterCard: extraction?.twitterCard as Prisma.InputJsonValue,
        redirectChain: fetchResult.redirectChain as Prisma.InputJsonValue,
        parserVersion: SEO_PARSER_VERSION,
      },
    });

    let issuesFound = 0;
    const pageIssues = evaluatePageRules({
      url: item.url,
      finalUrl: fetchResult.finalUrl,
      statusCode: fetchResult.statusCode,
      responseTimeMs: fetchResult.responseTimeMs,
      contentLength: fetchResult.contentLength,
      redirectChain: fetchResult.redirectChain,
      extraction,
      robotsHeader: fetchResult.robotsHeader,
      contentHash,
    });

    for (const issue of pageIssues) {
      await prisma.seoCrawlIssue.create({
        data: {
          organisationId: site.organisationId,
          projectId: site.projectId,
          brandId: site.brandId,
          seoSiteId: site.id,
          crawlRunId: run.id,
          pageId: page.id,
          snapshotId: snapshot.id,
          ruleId: issue.ruleId,
          ruleVersion: issue.ruleVersion,
          severity: issue.severity,
          affectedUrl: issue.affectedUrl,
          evidence: issue.evidence as Prisma.InputJsonValue,
          explanation: issue.explanation,
          recommendedAction: issue.recommendedAction,
        },
      });
      issuesFound += 1;
    }

    if (extraction) {
      for (const sd of extraction.structuredData) {
        await prisma.seoStructuredDataItem.create({
          data: {
            organisationId: site.organisationId,
            seoSiteId: site.id,
            pageId: page.id,
            snapshotId: snapshot.id,
            schemaType: sd.schemaType,
            format: sd.format,
            parsedContent: sd.content as Prisma.InputJsonValue,
            validationStatus: sd.schemaType === "Invalid" ? "INVALID" : "UNKNOWN",
            parsingError: sd.schemaType === "Invalid" ? "JSON parse failed" : undefined,
          },
        });
      }

      const allLinks = [...extraction.internalLinks, ...extraction.externalLinks];
      for (const link of allLinks) {
        const linkType = classifyLinkType(link.href, site.primaryDomain);
        await prisma.seoCrawlLink.create({
          data: {
            organisationId: site.organisationId,
            seoSiteId: site.id,
            crawlRunId: run.id,
            snapshotId: snapshot.id,
            sourcePageId: page.id,
            sourceUrl: fetchResult.finalUrl,
            destinationUrl: link.href,
            linkType,
            anchorText: link.anchorText,
            rel: link.rel,
            isFollowed: !link.rel?.includes("nofollow"),
            isImageLink: link.isImageLink,
          },
        });

        if (linkType === "INTERNAL" && item.depth < crawlConfig.maxDepth) {
          const normalised = normaliseUrl(link.href);
          const queueKey = digest(`${run.id}:${normalised.normalised}`);
          const existing = await prisma.seoCrawlQueueItem.findUnique({
            where: { idempotencyKey: queueKey },
          });
          if (!existing) {
            const pagesCount = await prisma.seoCrawlQueueItem.count({
              where: { crawlRunId: run.id },
            });
            if (pagesCount < crawlConfig.maxPages) {
              await prisma.seoCrawlQueueItem.create({
                data: {
                  organisationId: site.organisationId,
                  seoSiteId: site.id,
                  crawlRunId: run.id,
                  url: link.href,
                  normalisedUrl: normalised.normalised,
                  depth: item.depth + 1,
                  idempotencyKey: queueKey,
                },
              });
            }
          }
        }
      }
    }

    return { skipped: false, crawled: true, blocked: false, failed: false, issuesFound };
  },

  async fetchRobots(
    siteId: string,
    organisationId: string,
    allowedHostnames: string[],
    crawlConfig: { userAgent: string; requestTimeoutMs: number },
  ): Promise<{ crawlDelay?: number | null } | null> {
    const hostname = allowedHostnames[0];
    const robotsUrl = `https://${hostname}/robots.txt`;
    try {
      assertCrawlUrl(robotsUrl, allowedHostnames, true);
      const result = await safeFetch(robotsUrl, allowedHostnames, true, {
        userAgent: crawlConfig.userAgent,
        timeoutMs: crawlConfig.requestTimeoutMs,
        redirectLimit: 3,
        maxBytes: 100_000,
      });
      const parsed = result.body ? parseRobotsTxt(result.body) : null;
      await prisma.seoRobotsSnapshot.create({
        data: {
          organisationId,
          seoSiteId: siteId,
          fetchedUrl: robotsUrl,
          httpStatus: result.statusCode,
          contentHash: result.body ? digest(result.body) : undefined,
          content: result.body?.slice(0, 50_000),
          crawlDelay: parsed?.crawlDelay ?? undefined,
          sitemapUrls: parsed?.sitemaps ?? [],
          applicableRules: parsed?.rules as unknown as Prisma.InputJsonValue,
          parsingWarnings: parsed?.warnings ?? [],
        },
      });
      return { crawlDelay: parsed?.crawlDelay ?? null };
    } catch {
      incrementSeoCounter("robots_fetch_failures");
      return null;
    }
  },

  async finaliseRun(runId: string, siteId: string) {
    const snapshots = await prisma.seoPageSnapshot.findMany({
      where: { crawlRunId: runId },
      select: { contentHash: true, page: { select: { normalisedUrl: true } } },
    });
    const hashPages = snapshots
      .filter((s) => s.contentHash)
      .map((s) => ({ url: s.page.normalisedUrl, contentHash: s.contentHash! }));
    const dupIssues = findDuplicateContentHashes(hashPages);
    const run = await prisma.seoCrawlRun.findUnique({ where: { id: runId } });
    if (!run) return;

    for (const issue of dupIssues) {
      await prisma.seoCrawlIssue.create({
        data: {
          organisationId: run.organisationId,
          projectId: run.projectId,
          brandId: run.brandId,
          seoSiteId: siteId,
          crawlRunId: runId,
          ruleId: issue.ruleId,
          ruleVersion: issue.ruleVersion,
          severity: issue.severity,
          affectedUrl: issue.affectedUrl,
          evidence: issue.evidence as Prisma.InputJsonValue,
          explanation: issue.explanation,
          recommendedAction: issue.recommendedAction,
        },
      });
    }
  },

  async failRun(runId: string, error: string) {
    const run = await prisma.seoCrawlRun.findUnique({ where: { id: runId } });
    if (!run) return;
    const shouldRetry = run.attemptCount < run.maxAttempts;
    await prisma.seoCrawlRun.update({
      where: { id: runId },
      data: {
        status: shouldRetry ? SeoCrawlRunStatus.QUEUED : SeoCrawlRunStatus.FAILED,
        lastError: error,
        nextRetryAt: shouldRetry
          ? new Date(Date.now() + Math.pow(2, run.attemptCount) * 60_000)
          : undefined,
        leaseExpiresAt: null,
        workerId: null,
        completedAt: shouldRetry ? undefined : new Date(),
      },
    });
  },
};
