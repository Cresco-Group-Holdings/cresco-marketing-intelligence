import type { MarketingAutomationEnrollmentSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { evaluateCondition, type LeadSnapshot } from "@/lib/marketing-automation/conditions";
import {
  buildEnrollmentDedupeKey,
  checkEnrollmentEligibility,
  checkRepeatPolicy,
} from "@/lib/marketing-automation/enrollment";
import { shouldExitBeforeAction, type ExitRule } from "@/lib/marketing-automation/exit-rules";
import { matchTrigger, type TriggerEvent } from "@/lib/marketing-automation/triggers";
import { normaliseEmailAddress } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { marketingAutomationExecutionService } from "@/server/services/marketing-automation-execution-service";
import { recordAuditEvent } from "@/server/services/audit-service";

async function loadLeadContext(leadId: string, organisationId: string, brandId: string) {
  const lead = await prisma.crmLead.findFirst({
    where: { id: leadId, organisationId, brandId },
    include: {
      tagLinks: { include: { tag: true } },
      person: { include: { contactMethods: true } },
      source: true,
    },
  });
  if (!lead) return null;

  let consentMarketing = false;
  let suppressed = false;
  if (lead.marketingLeadId) {
    const consent = await prisma.leadConsent.findFirst({
      where: { marketingLeadId: lead.marketingLeadId, organisationId, brandId },
      orderBy: { recordedAt: "desc" },
    });
    consentMarketing = consent?.marketingOptIn ?? false;
    suppressed = consent?.suppressed ?? false;
  }

  const email = lead.person?.contactMethods.find((m) => m.methodType === "EMAIL")?.normalisedValue;
  if (email) {
    const emailSuppression = await prisma.emailSuppression.findFirst({
      where: { organisationId, emailAddress: normaliseEmailAddress(email) },
    });
    if (emailSuppression) suppressed = true;
  }

  const snapshot: LeadSnapshot = {
    leadId: lead.id,
    status: lead.status,
    lifecycleStage: lead.lifecycleStage,
    productInterest: lead.primaryProductInterest ?? undefined,
    country: lead.country ?? undefined,
    language: lead.preferredLanguage ?? undefined,
    consentMarketing,
    sourceType: lead.source?.sourceType,
    ownerUserId: lead.ownerUserId,
    lastActivityAt: lead.lastActivityAt ?? undefined,
    tags: lead.tagLinks.map((link) => link.tag.name),
  };

  return { lead, snapshot, consentMarketing, suppressed, unsubscribed: !consentMarketing && !!lead.marketingLeadId };
}

function mapExitRules(
  rules: Array<{ exitReason: string; config: Prisma.JsonValue | null; evaluateBeforeMessaging: boolean }>,
): ExitRule[] {
  return rules.map((rule) => ({
    exitReason: rule.exitReason as ExitRule["exitReason"],
    config: (rule.config as Record<string, unknown>) ?? undefined,
    evaluateBeforeMessaging: rule.evaluateBeforeMessaging,
  }));
}

export const marketingAutomationEnrollmentService = {
  async enrollLead(
    automationId: string,
    brandId: string,
    organisationId: string,
    input: {
      leadId: string;
      source?: MarketingAutomationEnrollmentSource;
      triggerEventId?: string;
      isTestEnrollment?: boolean;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const automation = await prisma.marketingAutomation.findFirst({
      where: { id: automationId, organisationId, brandId, archivedAt: null },
      include: { activeVersion: { include: { exitRules: true } } },
    });
    if (!automation) throw new AppError("NOT_FOUND", "Automation not found.");
    if (automation.globalStopped) throw new AppError("VALIDATION_ERROR", "Automation is globally stopped.");
    if (automation.status !== "ACTIVE" && !input.isTestEnrollment) {
      throw new AppError("VALIDATION_ERROR", "Automation is not active.");
    }

    const versionId = automation.activeVersionId;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "Automation has no active version.");

    const leadContext = await loadLeadContext(input.leadId, organisationId, brandId);
    if (!leadContext) throw new AppError("NOT_FOUND", "Lead not found.");

    const eligibility = checkEnrollmentEligibility({
      snapshot: leadContext.snapshot,
      consentMarketing: leadContext.consentMarketing,
      suppressed: leadContext.suppressed,
      unsubscribed: leadContext.unsubscribed,
      automationActive: automation.status === "ACTIVE" || !!input.isTestEnrollment,
    });
    if (!eligibility.eligible) {
      throw new AppError("VALIDATION_ERROR", eligibility.reasons.join(" "));
    }

    const priorEnrollments = await prisma.marketingAutomationEnrollment.findMany({
      where: { automationId, leadId: input.leadId },
      select: { automationId: true, leadId: true, status: true, enrolledAt: true, exitedAt: true, completedAt: true },
    });
    const repeatCheck = checkRepeatPolicy(
      automation.repeatEnrollmentPolicy,
      automationId,
      input.leadId,
      priorEnrollments.map((e) => ({
        automationId: e.automationId,
        leadId: e.leadId,
        status:
          e.status === "PAUSED" || e.status === "REMOVED"
            ? "ACTIVE"
            : e.status === "FAILED"
              ? "EXITED"
              : (e.status as "ACTIVE" | "COMPLETED" | "EXITED"),
        enrolledAt: e.enrolledAt,
        exitedAt: e.exitedAt,
        completedAt: e.completedAt,
      })),
    );
    if (!repeatCheck.allowed) {
      throw new AppError("VALIDATION_ERROR", repeatCheck.reason ?? "Repeat enrollment not allowed.");
    }

    const dedupeKey = buildEnrollmentDedupeKey(automationId, input.leadId, input.triggerEventId);
    const existing = await prisma.marketingAutomationEnrollment.findFirst({
      where: { automationId, dedupeKey },
    });
    if (existing) {
      throw new AppError("VALIDATION_ERROR", "Duplicate enrollment detected.");
    }

    const triggerNode = await prisma.marketingAutomationNode.findFirst({
      where: { versionId, nodeType: "TRIGGER" },
    });

    const enrollment = await prisma.$transaction(async (tx) => {
      const created = await tx.marketingAutomationEnrollment.create({
        data: {
          automationId,
          versionId,
          leadId: input.leadId,
          enrollmentSource: input.source ?? "MANUAL",
          dedupeKey,
          currentNodeId: triggerNode?.id,
          isTestEnrollment: input.isTestEnrollment ?? false,
          enrolledByUserId: context.userProfileId,
        },
      });

      if (triggerNode) {
        await tx.marketingAutomationEnrollmentState.create({
          data: { enrollmentId: created.id, nodeId: triggerNode.id, status: "ENTERED" },
        });
      }

      return created;
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.enroll",
      resourceType: "MarketingAutomationEnrollment",
      resourceId: enrollment.id,
      metadata: { automationId, brandId, leadId: input.leadId },
    });

    await marketingAutomationExecutionService.processEnrollment(
      enrollment.id,
      brandId,
      organisationId,
      context,
    );

    return enrollment;
  },

  async removeEnrollment(
    enrollmentId: string,
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    reason: "MANUAL_REMOVAL" = "MANUAL_REMOVAL",
  ) {
    await brandService.getById(brandId, organisationId, context);
    const enrollment = await prisma.marketingAutomationEnrollment.findFirst({
      where: { id: enrollmentId, automationId, automation: { organisationId, brandId } },
    });
    if (!enrollment) throw new AppError("NOT_FOUND", "Enrollment not found.");

    const updated = await prisma.marketingAutomationEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "EXITED",
        exitReason: reason,
        exitedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.removeEnrollment",
      resourceType: "MarketingAutomationEnrollment",
      resourceId: enrollmentId,
      metadata: { automationId, brandId, reason },
    });

    return updated;
  },

  async listEnrollments(
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { status?: string; leadId?: string },
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingAutomationEnrollment.findMany({
      where: {
        automationId,
        automation: { organisationId, brandId },
        ...(filters?.status ? { status: filters.status as never } : {}),
        ...(filters?.leadId ? { leadId: filters.leadId } : {}),
      },
      include: {
        lead: { select: { id: true, status: true, lifecycleStage: true } },
        currentNode: { select: { id: true, nodeKey: true, nodeType: true, label: true } },
        states: { orderBy: { enteredAt: "desc" }, take: 5 },
      },
      orderBy: { enrolledAt: "desc" },
      take: 200,
    });
  },

  async processTriggerEvent(
    brandId: string,
    organisationId: string,
    event: TriggerEvent & { leadId: string; triggerEventId?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const automations = await prisma.marketingAutomation.findMany({
      where: { organisationId, brandId, status: "ACTIVE", globalStopped: false, archivedAt: null },
      include: {
        activeVersion: { include: { triggers: true } },
      },
    });

    const enrolled: string[] = [];
    const skipped: Array<{ automationId: string; reason: string }> = [];

    for (const automation of automations) {
      const version = automation.activeVersion;
      if (!version) continue;

      const matchingTrigger = version.triggers.find(
        (trigger) => trigger.isEnabled && matchTrigger(
          { triggerType: trigger.triggerType, ...(trigger.config as Record<string, unknown>) } as never,
          event,
        ),
      );
      if (!matchingTrigger) continue;

      try {
        const enrollment = await this.enrollLead(
          automation.id,
          brandId,
          organisationId,
          {
            leadId: event.leadId,
            source: "TRIGGER",
            triggerEventId: event.triggerEventId,
          },
          context,
        );
        enrolled.push(enrollment.id);
      } catch (error) {
        skipped.push({
          automationId: automation.id,
          reason: error instanceof AppError ? error.message : "Enrollment failed.",
        });
      }
    }

    return { enrolled, skipped };
  },

  async evaluateExitRules(
    enrollmentId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    options?: { beforeMessaging?: boolean },
  ) {
    const enrollment = await prisma.marketingAutomationEnrollment.findFirst({
      where: { id: enrollmentId, automation: { organisationId, brandId } },
      include: {
        automation: true,
        version: { include: { exitRules: true } },
      },
    });
    if (!enrollment) throw new AppError("NOT_FOUND", "Enrollment not found.");

    const leadContext = await loadLeadContext(enrollment.leadId, organisationId, brandId);
    if (!leadContext) throw new AppError("NOT_FOUND", "Lead not found.");

    const rules = mapExitRules(enrollment.version.exitRules);
    const filteredRules = options?.beforeMessaging
      ? rules.filter((rule) => rule.evaluateBeforeMessaging !== false)
      : rules;

    const result = shouldExitBeforeAction(filteredRules, {
      snapshot: leadContext.snapshot,
      suppressed: leadContext.suppressed,
      unsubscribed: leadContext.unsubscribed,
      consentMarketing: leadContext.consentMarketing,
      automationStopped: enrollment.automation.status === "STOPPED" || enrollment.automation.globalStopped,
    });

    if (result.exit && result.reason) {
      await prisma.marketingAutomationEnrollment.update({
        where: { id: enrollmentId },
        data: { status: "EXITED", exitReason: result.reason, exitedAt: new Date() },
      });
    }

    return result;
  },

  buildLeadSnapshot: loadLeadContext,

  evaluateNodeCondition(
    snapshot: LeadSnapshot,
    condition: { field: string; operator: string; value?: unknown },
  ) {
    return evaluateCondition(condition as Parameters<typeof evaluateCondition>[0], snapshot);
  },
};
