import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { countEligibleIdentities } from "@/lib/advertising-audiences/privacy";
import { checkProviderEligibility, PROVIDER_AUDIENCE_MAPPINGS } from "@/lib/advertising-audiences/provider-mapping";
import { detectSensitiveTargeting, hasBlockingSensitiveViolations, requiresHumanBridgeSafeguards } from "@/lib/advertising-audiences/sensitive-policy";
import type { TenantContext } from "@/lib/tenancy/context";
import { advertisingAudienceService } from "@/server/services/advertising-audience-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingAudienceEligibilityService = {
  async runChecks(audienceId: string, brandId: string, organisationId: string, context: TenantContext) {
    const audience = await advertisingAudienceService.getById(audienceId, brandId, organisationId, context);
    const brand = await brandService.getById(brandId, organisationId, context);
    const checks: Array<{
      checkType: string;
      status: "ELIGIBLE" | "NEEDS_ATTENTION" | "NOT_ELIGIBLE" | "PENDING_REVIEW";
      severity: string;
      title: string;
      description: string;
      evidence?: Record<string, unknown>;
    }> = [];

    const textBlob = [
      audience.name,
      audience.description ?? "",
      ...audience.rules.map((r) => r.ruleKey),
    ].join(" ");

    const sensitiveViolations = detectSensitiveTargeting(textBlob);
    if (hasBlockingSensitiveViolations(sensitiveViolations)) {
      checks.push({
        checkType: "sensitive_targeting",
        status: "NOT_ELIGIBLE",
        severity: "BLOCKING",
        title: "Sensitive targeting detected",
        description: `Prohibited attributes: ${sensitiveViolations.map((v) => v.attribute).join(", ")}`,
        evidence: { violations: sensitiveViolations },
      });
    }

    if (requiresHumanBridgeSafeguards(brand.slug) && !audience.consentPolicy?.humanBridgeSafeguards) {
      checks.push({
        checkType: "humanbridge_safeguards",
        status: "NOT_ELIGIBLE",
        severity: "BLOCKING",
        title: "HumanBridge safeguards required",
        description: "Additional consent and purpose-limitation safeguards must be enabled.",
      });
    }

    if (!audience.consentPolicy) {
      checks.push({
        checkType: "missing_consent_policy",
        status: "NOT_ELIGIBLE",
        severity: "HIGH",
        title: "Consent policy missing",
        description: "A consent policy must be defined before audience approval.",
      });
    }

    if (audience.rules.length === 0) {
      checks.push({
        checkType: "missing_rules",
        status: "NEEDS_ATTENTION",
        severity: "MEDIUM",
        title: "No audience rules defined",
        description: "Add at least one approved rule condition.",
      });
    }

    const leads = await prisma.marketingLead.findMany({
      where: { organisationId, brandId },
      select: {
        retentionStatus: true,
        country: true,
        consents: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
      take: 10000,
    });

    const identities = leads.map((l) => ({
      marketingOptIn: l.consents[0]?.marketingOptIn ?? false,
      retentionStatus: l.retentionStatus,
      suppressed: l.consents[0]?.suppressed ?? l.retentionStatus === "SUPPRESSED",
      deleted: l.retentionStatus === "DELETED",
      country: l.country,
    }));

    const policy = audience.consentPolicy ?? {
      marketingConsentRequired: true,
      dataSources: [],
      customerListEligible: false,
      deletionExcluded: true,
      geoRestrictions: [],
    };

    const counts = countEligibleIdentities(identities, policy);

    await prisma.advertisingAudienceEstimate.create({
      data: {
        organisationId,
        audienceId,
        eligibleCount: counts.eligible,
        excludedCount: counts.excluded,
        consentCoveredCount: counts.consentCovered,
        providerMatchNote: "Provider match extension point — not estimated in Task 5.3.",
        freshnessAt: new Date(),
        sourceCoverage: { leads: leads.length } as Prisma.InputJsonValue,
      },
    });

    if (counts.eligible === 0) {
      checks.push({
        checkType: "zero_eligible",
        status: "NOT_ELIGIBLE",
        severity: "HIGH",
        title: "No eligible identities",
        description: "All identities excluded by consent, deletion, or suppression rules.",
      });
    }

    for (const [provider, mapping] of Object.entries(PROVIDER_AUDIENCE_MAPPINGS)) {
      const result = checkProviderEligibility(provider, counts.eligible, audience.retargetingWindowDays);
      const existing = await prisma.advertisingAudienceProviderMapping.findFirst({
        where: { audienceId, provider },
      });
      if (existing) {
        await prisma.advertisingAudienceProviderMapping.update({
          where: { id: existing.id },
          data: {
            eligibilityStatus: result.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
            policyWarnings: result.warnings,
          },
        });
      } else {
        await prisma.advertisingAudienceProviderMapping.create({
          data: {
            organisationId,
            audienceId,
            provider,
            providerAudienceType: mapping.providerAudienceType,
            eligibilityStatus: result.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
            minimumSizeRule: mapping.minimumSizeRule,
            requiredIdentifierType: mapping.requiredIdentifierType,
            supportedRetentionDays: mapping.supportedRetentionDays,
            policyWarnings: result.warnings,
            isActivated: false,
          },
        });
      }

      if (!result.eligible) {
        checks.push({
          checkType: `provider_${provider.toLowerCase()}`,
          status: "NOT_ELIGIBLE",
          severity: "HIGH",
          title: `${provider} not eligible`,
          description: result.errors.join(" "),
        });
      }
    }

    if (audience.retargetingWindowDays) {
      const expiredLeads = leads.filter((l) => {
        // Placeholder: real implementation would use lastActivityAt
        return false;
      });
      if (expiredLeads.length > 0) {
        checks.push({
          checkType: "retargeting_expired",
          status: "NEEDS_ATTENTION",
          severity: "MEDIUM",
          title: "Retargeting window expired for some identities",
          description: `${expiredLeads.length} identities outside ${audience.retargetingWindowDays}-day window.`,
        });
      }
    }

    await prisma.advertisingAudienceEligibilityCheck.deleteMany({ where: { audienceId } });
    for (const check of checks) {
      await prisma.advertisingAudienceEligibilityCheck.create({
        data: {
          organisationId,
          audienceId,
          checkType: check.checkType,
          status: check.status,
          severity: check.severity,
          title: check.title,
          description: check.description,
          evidence: check.evidence as Prisma.InputJsonValue | undefined,
        },
      });
    }

    const hasBlocking = checks.some((c) => c.status === "NOT_ELIGIBLE");
    return { checks, counts, overallStatus: hasBlocking ? "NOT_ELIGIBLE" : checks.length ? "NEEDS_ATTENTION" : "ELIGIBLE" };
  },
};
