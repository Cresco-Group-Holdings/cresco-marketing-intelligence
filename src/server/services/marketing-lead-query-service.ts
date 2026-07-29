import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { minimiseLeadExport } from "@/lib/leads/privacy";
import { QUALIFIED_LEAD_STATUSES } from "@/lib/leads/constants";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type { LeadFilters } from "@/server/services/marketing-lead-service";
import { brandService } from "@/server/services/workspace-service";

function buildWhere(
  brandId: string,
  organisationId: string,
  filters: LeadFilters,
): Prisma.MarketingLeadWhereInput {
  return {
    organisationId,
    brandId,
    status: filters.status ?? { not: "DELETED" },
    ...(filters.provider ? { sourcePlatform: filters.provider } : {}),
    ...(filters.assignedToUserId ? { assignedToUserId: filters.assignedToUserId } : {}),
    ...(filters.duplicateWarning ? { isDuplicateWarning: true } : {}),
    ...(filters.qualifiedOnly ? { status: { in: QUALIFIED_LEAD_STATUSES } } : {}),
    ...(filters.creationSource ? { source: { creationSource: filters.creationSource } } : {}),
    ...(filters.qualificationProfile
      ? {
          qualifications: {
            some: { profile: filters.qualificationProfile, qualified: true },
          },
        }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { displayName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { company: { contains: filters.search, mode: "insensitive" } },
            { providerUsername: { contains: filters.search, mode: "insensitive" } },
            { expressedInterest: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const marketingLeadQueryService = {
  async summary(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const baseWhere = { organisationId, brandId, status: { not: "DELETED" as const } };
    const [total, qualified, reviewing, duplicateWarnings, unreadNew] = await Promise.all([
      prisma.marketingLead.count({ where: baseWhere }),
      prisma.marketingLead.count({
        where: { ...baseWhere, status: { in: QUALIFIED_LEAD_STATUSES } },
      }),
      prisma.marketingLead.count({ where: { ...baseWhere, status: "REVIEWING" } }),
      prisma.marketingLead.count({ where: { ...baseWhere, isDuplicateWarning: true } }),
      prisma.marketingLead.count({ where: { ...baseWhere, status: "NEW" } }),
    ]);
    return { total, qualified, reviewing, duplicateWarnings, unreadNew };
  },

  async list(brandId: string, organisationId: string, filters: LeadFilters, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const limit = filters.limit ?? 25;
    const items = await prisma.marketingLead.findMany({
      where: buildWhere(brandId, organisationId, filters),
      include: {
        source: true,
        consents: { orderBy: { recordedAt: "desc" }, take: 1 },
        qualifications: { orderBy: { updatedAt: "desc" }, take: 1 },
        assignments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            assignedTo: { select: { id: true, displayName: true, email: true } },
          },
        },
        socialAccount: {
          select: { id: true, username: true, displayName: true, provider: true },
        },
        contentItem: {
          select: { id: true, title: true, campaignName: true, primaryCTA: true },
        },
      },
      orderBy: [{ latestInteractionAt: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  },

  async getById(
    brandId: string,
    organisationId: string,
    leadId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const lead = await prisma.marketingLead.findFirst({
      where: { id: leadId, organisationId, brandId, status: { not: "DELETED" } },
      include: {
        source: true,
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
        qualifications: { orderBy: { updatedAt: "desc" } },
        consents: { orderBy: { recordedAt: "desc" } },
        assignments: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedTo: { select: { id: true, displayName: true, email: true } },
            assignedBy: { select: { id: true, displayName: true, email: true } },
          },
        },
        crmHandoffs: { orderBy: { createdAt: "desc" }, take: 10 },
        socialAccount: {
          select: { id: true, username: true, displayName: true, provider: true },
        },
        contentItem: {
          select: {
            id: true,
            title: true,
            campaignName: true,
            primaryCTA: true,
            destinationUrl: true,
          },
        },
        duplicateOf: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!lead) {
      throw new AppError("NOT_FOUND", "Lead was not found.");
    }
    assertOrganisationScope(lead.organisationId, context);
    return lead;
  },

  async export(
    brandId: string,
    organisationId: string,
    filters: LeadFilters & { format: "CSV" | "JSON" },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const leads = await prisma.marketingLead.findMany({
      where: buildWhere(brandId, organisationId, filters),
      include: { source: true, consents: { orderBy: { recordedAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const rows = leads.map((lead) => ({
      id: lead.id,
      status: lead.status,
      ...minimiseLeadExport(lead, "CRM"),
      source: lead.source?.creationSource,
      provider: lead.sourcePlatform,
      campaign: lead.sourceCampaign,
      createdAt: lead.createdAt.toISOString(),
      consentState: lead.consents[0]?.consentState,
      marketingOptIn: lead.consents[0]?.marketingOptIn ?? false,
    }));

    await prisma.leadExport.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        format: filters.format,
        rowCount: rows.length,
        filters: filters as Prisma.InputJsonValue,
        requestedById: context.userProfileId,
        fileName: `leads-${brand.slug}-${new Date().toISOString().slice(0, 10)}.${filters.format.toLowerCase()}`,
      },
    });

    if (filters.format === "JSON") {
      return {
        contentType: "application/json",
        body: JSON.stringify({ metadata: { timezone: "UTC", rowCount: rows.length }, rows }, null, 2),
      };
    }

    const headers = [
      "id",
      "status",
      "displayName",
      "email",
      "phone",
      "company",
      "country",
      "source",
      "provider",
      "campaign",
      "consentState",
      "marketingOptIn",
      "createdAt",
    ];
    const csvLines = [
      `# timezone=UTC rowCount=${rows.length}`,
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) => {
            const value = row[key as keyof typeof row];
            const text = value === undefined || value === null ? "" : String(value);
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ];
    return { contentType: "text/csv", body: csvLines.join("\n") };
  },
};
