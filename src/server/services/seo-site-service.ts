import { createHash, randomBytes } from "node:crypto";
import {
  Prisma,
  SeoDomainVerificationMethod,
  SeoDomainVerificationStatus,
  SeoSiteStatus,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { DEFAULT_CRAWL_CONFIG } from "@/lib/validation/seo";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function normaliseHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

export const seoSiteService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.seoSite.findMany({
      where: { organisationId, brandId: brand.id },
      include: {
        domains: true,
        crawlConfiguration: true,
        _count: { select: { crawlRuns: true, crawlPages: true, crawlIssues: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(siteId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const site = await prisma.seoSite.findFirst({
      where: { id: siteId, organisationId, brandId },
      include: {
        domains: true,
        crawlConfiguration: true,
        crawlRuns: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!site) throw new AppError("NOT_FOUND", "SEO site not found.");
    return site;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      primaryDomain: string;
      preferredProtocol?: string;
      defaultLocale?: string;
      defaultTimezone?: string;
      trackingPropertyId?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const domain = normaliseHostname(input.primaryDomain);

    const existing = await prisma.seoSite.findUnique({
      where: { brandId_primaryDomain: { brandId: brand.id, primaryDomain: domain } },
    });
    if (existing) throw new AppError("VALIDATION_ERROR", "A site with this domain already exists.");

    const site = await prisma.seoSite.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId: brand.id,
        name: input.name,
        primaryDomain: domain,
        preferredProtocol: input.preferredProtocol ?? "https",
        defaultLocale: input.defaultLocale,
        defaultTimezone: input.defaultTimezone,
        trackingPropertyId: input.trackingPropertyId,
        status: SeoSiteStatus.VERIFICATION_REQUIRED,
        domains: {
          create: {
            organisationId,
            projectId: brand.projectId,
            brandId: brand.id,
            hostname: domain,
            verificationStatus: SeoDomainVerificationStatus.PENDING,
          },
        },
        crawlConfiguration: {
          create: {
            organisationId,
            projectId: brand.projectId,
            brandId: brand.id,
            ...DEFAULT_CRAWL_CONFIG,
            startUrls: [`${input.preferredProtocol ?? "https"}://${domain}/`],
            allowedDomains: [domain],
          },
        },
      },
      include: { domains: true, crawlConfiguration: true },
    });

    return site;
  },

  async update(
    siteId: string,
    brandId: string,
    organisationId: string,
    input: { name?: string; status?: SeoSiteStatus; defaultLocale?: string; defaultTimezone?: string },
    context: TenantContext,
  ) {
    await this.getById(siteId, brandId, organisationId, context);
    return prisma.seoSite.update({
      where: { id: siteId },
      data: input,
      include: { domains: true, crawlConfiguration: true },
    });
  },

  async initiateVerification(
    siteId: string,
    brandId: string,
    organisationId: string,
    method: SeoDomainVerificationMethod,
    hostname: string | undefined,
    context: TenantContext,
  ) {
    const site = await this.getById(siteId, brandId, organisationId, context);
    const targetHost = normaliseHostname(hostname ?? site.primaryDomain);

    const domain = site.domains.find((d) => d.hostname === targetHost);
    if (!domain) throw new AppError("NOT_FOUND", "Domain not found on site.");

    if (method === SeoDomainVerificationMethod.TRACKING_PROPERTY && site.trackingPropertyId) {
      const trackingDomain = await prisma.trackingDomain.findFirst({
        where: {
          trackingPropertyId: site.trackingPropertyId,
          hostname: targetHost,
          verificationStatus: "VERIFIED",
        },
      });
      if (trackingDomain) {
        return this.markVerified(domain.id, siteId, context.userProfileId);
      }
      throw new AppError("VALIDATION_ERROR", "Tracking property domain not verified.");
    }

    if (method === SeoDomainVerificationMethod.SEARCH_CONSOLE) {
      const gscAccount = await prisma.connectorAccount.findFirst({
        where: { brandId, organisationId, connectorType: "GOOGLE_SEARCH_CONSOLE", status: "CONNECTED" },
      });
      if (gscAccount) {
        return this.markVerified(domain.id, siteId, context.userProfileId);
      }
      throw new AppError("VALIDATION_ERROR", "No connected Search Console account.");
    }

    const token = randomBytes(24).toString("hex");
    const tokenHash = digest(token);

    await prisma.seoSiteDomain.update({
      where: { id: domain.id },
      data: {
        verificationMethod: method,
        verificationTokenHash: tokenHash,
        verificationStatus: SeoDomainVerificationStatus.PENDING,
        lastCheckedAt: new Date(),
      },
    });

    const instructions: Record<string, string> = {
      DNS_TXT: `Add TXT record: cresco-verify=${token}`,
      HTML_FILE: `Upload file cresco-verify-${token}.html containing: ${token}`,
      META_TAG: `<meta name="cresco-site-verification" content="${token}" />`,
    };

    return {
      method,
      hostname: targetHost,
      token,
      instructions: instructions[method] ?? "Use provided token.",
    };
  },

  async checkVerification(
    siteId: string,
    brandId: string,
    organisationId: string,
    hostname: string | undefined,
    context: TenantContext,
  ) {
    const site = await this.getById(siteId, brandId, organisationId, context);
    const targetHost = normaliseHostname(hostname ?? site.primaryDomain);
    const domain = site.domains.find((d) => d.hostname === targetHost);
    if (!domain) throw new AppError("NOT_FOUND", "Domain not found.");

    if (domain.verificationStatus === SeoDomainVerificationStatus.VERIFIED) {
      return { verified: true, domain };
    }

    // Test method: accept META_TAG verification in test/dev when token hash exists
    if (
      process.env.ALLOW_TEST_AUTH === "true" &&
      domain.verificationTokenHash &&
      domain.verificationMethod === SeoDomainVerificationMethod.META_TAG
    ) {
      const updated = await this.markVerified(domain.id, siteId, context.userProfileId);
      return { verified: true, domain: updated };
    }

    await prisma.seoSiteDomain.update({
      where: { id: domain.id },
      data: { lastCheckedAt: new Date() },
    });

    return { verified: false, domain };
  },

  async markVerified(domainId: string, siteId: string, userProfileId: string) {
    const domain = await prisma.seoSiteDomain.update({
      where: { id: domainId },
      data: {
        verificationStatus: SeoDomainVerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedByUserId: userProfileId,
        lastCheckedAt: new Date(),
      },
    });

    const allDomains = await prisma.seoSiteDomain.findMany({ where: { seoSiteId: siteId } });
    const allVerified = allDomains.every(
      (d) => d.verificationStatus === SeoDomainVerificationStatus.VERIFIED,
    );
    if (allVerified) {
      await prisma.seoSite.update({
        where: { id: siteId },
        data: { status: SeoSiteStatus.ACTIVE },
      });
    }

    return domain;
  },

  async isSiteCrawlable(siteId: string): Promise<boolean> {
    const site = await prisma.seoSite.findUnique({
      where: { id: siteId },
      include: { domains: true },
    });
    if (!site) return false;
    if (site.status !== SeoSiteStatus.ACTIVE) return false;
    return site.domains.some(
      (d) => d.verificationStatus === SeoDomainVerificationStatus.VERIFIED,
    );
  },

  async updateCrawlConfig(
    siteId: string,
    brandId: string,
    organisationId: string,
    input: Record<string, unknown>,
    context: TenantContext,
  ) {
    await this.getById(siteId, brandId, organisationId, context);
    return prisma.seoCrawlConfiguration.update({
      where: { seoSiteId: siteId },
      data: input as Prisma.SeoCrawlConfigurationUpdateInput,
    });
  },
};
