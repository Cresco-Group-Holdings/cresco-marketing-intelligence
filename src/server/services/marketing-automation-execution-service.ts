import type { MarketingAutomationActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { evaluateCondition, type LeadSnapshot } from "@/lib/marketing-automation/conditions";
import { computeDelayResumeAt } from "@/lib/marketing-automation/delays";
import { shouldExitBeforeAction, type ExitRule } from "@/lib/marketing-automation/exit-rules";
import { checkActionFrequency } from "@/lib/marketing-automation/safety";
import { normaliseEmailAddress } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { crmService } from "@/server/services/crm-service";
import { crmTaskService } from "@/server/services/crm-task-service";
import { emailMessageService } from "@/server/services/email-message-service";
import { brandService } from "@/server/services/workspace-service";

const MAX_STEPS_PER_RUN = 20;

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

export const marketingAutomationExecutionService = {
  async processEnrollment(
    enrollmentId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    let steps = 0;
    let continueProcessing = true;

    while (continueProcessing && steps < MAX_STEPS_PER_RUN) {
      const enrollment = await prisma.marketingAutomationEnrollment.findFirst({
        where: { id: enrollmentId, automation: { organisationId, brandId } },
        include: {
          automation: true,
          version: {
            include: {
              nodes: {
                include: {
                  condition: true,
                  delay: true,
                  outgoingEdges: { include: { targetNode: true } },
                },
              },
              exitRules: true,
            },
          },
        },
      });

      if (!enrollment || enrollment.status !== "ACTIVE") {
        return { status: enrollment?.status ?? "NOT_FOUND", steps };
      }

      if (enrollment.automation.globalStopped || enrollment.automation.status === "STOPPED") {
        await this.exitEnrollment(enrollmentId, "AUTOMATION_STOPPED");
        return { status: "EXITED", steps };
      }

      const leadContext = await loadLeadContext(enrollment.leadId, organisationId, brandId);
      const exitRules = mapExitRules(enrollment.version.exitRules);
      const exitResult = shouldExitBeforeAction(
        exitRules.filter((rule) => rule.evaluateBeforeMessaging !== false),
        {
          snapshot: leadContext?.snapshot ?? { leadId: enrollment.leadId },
          suppressed: leadContext?.suppressed ?? false,
          unsubscribed: leadContext?.unsubscribed ?? false,
          consentMarketing: leadContext?.consentMarketing ?? false,
          automationStopped:
            enrollment.automation.globalStopped ||
            (enrollment.automation.status as string) === "STOPPED",
        },
      );
      if (exitResult.exit && exitResult.reason) {
        await prisma.marketingAutomationEnrollment.update({
          where: { id: enrollmentId },
          data: { status: "EXITED", exitReason: exitResult.reason, exitedAt: new Date() },
        });
        return { status: "EXITED", steps, reason: exitResult.reason };
      }

      const currentNode = enrollment.version.nodes.find((n) => n.id === enrollment.currentNodeId);
      if (!currentNode) {
        await this.completeEnrollment(enrollmentId);
        return { status: "COMPLETED", steps };
      }

      switch (currentNode.nodeType) {
        case "TRIGGER":
        case "BRANCH": {
          const next = currentNode.outgoingEdges[0]?.targetNode;
          if (!next) {
            await this.completeEnrollment(enrollmentId);
            return { status: "COMPLETED", steps };
          }
          await this.advanceToNode(enrollmentId, currentNode.id, next.id);
          steps += 1;
          break;
        }

        case "CONDITION": {
          const passes = currentNode.condition && leadContext
            ? evaluateCondition(
                {
                  field: currentNode.condition.field,
                  operator: currentNode.condition.operator as Parameters<typeof evaluateCondition>[0]["operator"],
                  value: currentNode.condition.value,
                },
                leadContext.snapshot,
              )
            : true;
          const edge = currentNode.outgoingEdges.find(
            (e) => e.branchLabel === (passes ? "true" : "false"),
          ) ?? currentNode.outgoingEdges[passes ? 0 : 1] ?? currentNode.outgoingEdges[0];
          if (!edge?.targetNode) {
            await this.completeEnrollment(enrollmentId);
            return { status: "COMPLETED", steps };
          }
          await this.advanceToNode(enrollmentId, currentNode.id, edge.targetNodeId);
          steps += 1;
          break;
        }

        case "DELAY": {
          const activeState = await prisma.marketingAutomationEnrollmentState.findFirst({
            where: { enrollmentId, nodeId: currentNode.id, exitedAt: null },
            orderBy: { enteredAt: "desc" },
          });
          const metadata = (activeState?.metadata as Record<string, unknown>) ?? {};
          const resumeAt = metadata.resumeAt ? new Date(String(metadata.resumeAt)) : null;

          if (!resumeAt && currentNode.delay) {
            const computed = computeDelayResumeAt({
              delayType: currentNode.delay.delayType,
              durationMinutes: currentNode.delay.durationMinutes ?? undefined,
              untilAt: currentNode.delay.untilAt?.toISOString(),
              timezone: currentNode.delay.timezone ?? undefined,
              businessDaysOnly: currentNode.delay.businessDaysOnly,
              daypartStart: currentNode.delay.daypartStart ?? undefined,
              daypartEnd: currentNode.delay.daypartEnd ?? undefined,
              waitEventType: currentNode.delay.waitEventType ?? undefined,
              maxWaitMinutes: currentNode.delay.maxWaitMinutes ?? undefined,
            });
            if (activeState) {
              await prisma.marketingAutomationEnrollmentState.update({
                where: { id: activeState.id },
                data: { metadata: { resumeAt: computed.toISOString() } },
              });
            }
            continueProcessing = false;
            return { status: "WAITING", steps, resumeAt: computed };
          }

          if (resumeAt && resumeAt > new Date()) {
            continueProcessing = false;
            return { status: "WAITING", steps, resumeAt };
          }

          if (activeState) {
            await prisma.marketingAutomationEnrollmentState.update({
              where: { id: activeState.id },
              data: { exitedAt: new Date(), status: "COMPLETED" },
            });
          }

          const next = currentNode.outgoingEdges[0]?.targetNode;
          if (!next) {
            await this.completeEnrollment(enrollmentId);
            return { status: "COMPLETED", steps };
          }
          await this.advanceToNode(enrollmentId, currentNode.id, next.id);
          steps += 1;
          break;
        }

        case "ACTION": {
          const config = (currentNode.config as Record<string, unknown>) ?? {};
          const actionType = String(config.actionType ?? "") as MarketingAutomationActionType;
          if (!actionType) {
            await this.recordError({
              automationId: enrollment.automationId,
              enrollmentId,
              nodeId: currentNode.id,
              errorCode: "MISSING_ACTION_TYPE",
              message: "Action node is missing actionType.",
            });
            await this.exitEnrollment(enrollmentId, "ERROR");
            return { status: "FAILED", steps };
          }

          const frequencyHistory = await this.loadActionFrequencyHistory(enrollment.leadId, actionType);
          const frequencyCheck = checkActionFrequency(actionType, frequencyHistory);
          if (!frequencyCheck.allowed) {
            await this.recordActionRun({
              enrollmentId,
              nodeId: currentNode.id,
              actionType,
              status: "SKIPPED",
              result: { reason: frequencyCheck.reason },
            });
          } else {
            try {
              const result = await this.executeAction(
                actionType,
                config,
                enrollment.leadId,
                brandId,
                organisationId,
                context,
              );
              await this.recordActionRun({
                enrollmentId,
                nodeId: currentNode.id,
                actionType,
                status: "SUCCEEDED",
                result,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : "Action execution failed.";
              await this.recordActionRun({
                enrollmentId,
                nodeId: currentNode.id,
                actionType,
                status: "FAILED",
                errorMessage: message,
              });
              await this.recordError({
                automationId: enrollment.automationId,
                enrollmentId,
                nodeId: currentNode.id,
                errorCode: "ACTION_FAILED",
                message,
                metadata: { actionType },
              });
              await this.exitEnrollment(enrollmentId, "ERROR");
              return { status: "FAILED", steps, error: message };
            }
          }

          const next = currentNode.outgoingEdges[0]?.targetNode;
          if (!next) {
            await this.completeEnrollment(enrollmentId);
            return { status: "COMPLETED", steps };
          }
          await this.advanceToNode(enrollmentId, currentNode.id, next.id);
          steps += 1;
          break;
        }

        case "GOAL":
        case "EXIT":
        case "END": {
          await this.completeEnrollment(enrollmentId);
          return { status: "COMPLETED", steps };
        }

        default:
          continueProcessing = false;
          break;
      }
    }

    return { status: "ACTIVE", steps };
  },

  async executeAction(
    actionType: MarketingAutomationActionType,
    config: Record<string, unknown>,
    leadId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    switch (actionType) {
      case "SEND_EMAIL": {
        const leadContext = await loadLeadContext(leadId, organisationId, brandId);
        const email = leadContext?.lead.person?.contactMethods.find((m) => m.methodType === "EMAIL");
        if (!email || !leadContext) throw new AppError("VALIDATION_ERROR", "Lead has no email address.");

        const message = await emailMessageService.queueMessage(
          brandId,
          organisationId,
          {
            senderIdentityId: String(config.senderIdentityId),
            category: "MARKETING",
            subject: String(config.subject ?? "Message from automation"),
            templateId: config.templateId ? String(config.templateId) : undefined,
            templateVersionId: config.templateVersionId ? String(config.templateVersionId) : undefined,
            idempotencyKey: config.idempotencyKey ? String(config.idempotencyKey) : `automation-${leadId}-${Date.now()}`,
            recipients: [{ emailAddress: email.normalisedValue, displayName: email.displayValue }],
            consent: { marketing: leadContext.consentMarketing, transactional: true },
          },
          context,
        );
        await emailMessageService.dispatchMessage(message.id, brandId, organisationId, context);
        return { messageId: message.id };
      }

      case "CREATE_TASK":
        return crmTaskService.createTask(
          brandId,
          organisationId,
          {
            title: String(config.title),
            description: config.description ? String(config.description) : undefined,
            taskTypeCode: config.taskType as never,
            ownerUserId: config.ownerUserId ? String(config.ownerUserId) : undefined,
            leadId,
            dueDate: config.dueDate ? String(config.dueDate) : undefined,
          },
          context,
        );

      case "ASSIGN_OWNER":
        return crmService.assignOwner(
          leadId,
          brandId,
          organisationId,
          String(config.ownerUserId),
          context,
        );

      case "UPDATE_LEAD_STATUS":
        return crmService.updateLeadStatus(
          leadId,
          brandId,
          organisationId,
          String(config.status),
          config.reason ? String(config.reason) : "Automation action",
          context,
        );

      case "UPDATE_LIFECYCLE":
        return prisma.crmLead.update({
          where: { id: leadId },
          data: { lifecycleStage: String(config.lifecycleStage) as never, lastActivityAt: new Date() },
        });

      case "APPLY_TAG":
      case "REMOVE_TAG": {
        const tagName = String(config.tag);
        const tag = await prisma.crmLeadTag.upsert({
          where: { organisationId_name: { organisationId, name: tagName } },
          create: { organisationId, name: tagName },
          update: {},
        });
        if (actionType === "APPLY_TAG") {
          await prisma.crmLeadTagLink.upsert({
            where: { leadId_tagId: { leadId, tagId: tag.id } },
            create: { leadId, tagId: tag.id },
            update: {},
          });
        } else {
          await prisma.crmLeadTagLink.deleteMany({ where: { leadId, tagId: tag.id } });
        }
        return { tagId: tag.id, tagName };
      }

      case "SEND_INTERNAL_NOTIFICATION":
        return { delivered: true, message: String(config.message) };

      case "WEBHOOK":
        return { url: String(config.url), dispatched: true };

      case "WAIT":
      case "BRANCH":
      case "END":
        return { skipped: true };

      default:
        throw new AppError("VALIDATION_ERROR", `Unsupported action type: ${actionType}`);
    }
  },

  async recordActionRun(input: {
    enrollmentId: string;
    nodeId: string;
    actionType: MarketingAutomationActionType;
    status: string;
    result?: Prisma.InputJsonValue;
    errorMessage?: string;
  }) {
    return prisma.marketingAutomationActionRun.create({
      data: {
        enrollmentId: input.enrollmentId,
        nodeId: input.nodeId,
        actionType: input.actionType,
        status: input.status,
        startedAt: new Date(),
        completedAt: new Date(),
        result: input.result,
        errorMessage: input.errorMessage,
      },
    });
  },

  async recordError(input: {
    automationId: string;
    enrollmentId?: string;
    nodeId?: string;
    errorCode: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.marketingAutomationError.create({
      data: input,
    });
  },

  async advanceToNode(enrollmentId: string, fromNodeId: string, toNodeId: string) {
    await prisma.$transaction([
      prisma.marketingAutomationEnrollmentState.updateMany({
        where: { enrollmentId, nodeId: fromNodeId, exitedAt: null },
        data: { exitedAt: new Date(), status: "COMPLETED" },
      }),
      prisma.marketingAutomationEnrollmentState.create({
        data: { enrollmentId, nodeId: toNodeId, status: "ENTERED" },
      }),
      prisma.marketingAutomationEnrollment.update({
        where: { id: enrollmentId },
        data: { currentNodeId: toNodeId },
      }),
    ]);
  },

  async completeEnrollment(enrollmentId: string) {
    await prisma.marketingAutomationEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  },

  async exitEnrollment(enrollmentId: string, reason: "AUTOMATION_STOPPED" | "ERROR" | "MANUAL_REMOVAL") {
    await prisma.marketingAutomationEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "EXITED", exitReason: reason, exitedAt: new Date() },
    });
  },

  async loadActionFrequencyHistory(leadId: string, actionType: MarketingAutomationActionType) {
    const runs = await prisma.marketingAutomationActionRun.findMany({
      where: {
        actionType,
        enrollment: { leadId },
        status: "SUCCEEDED",
        completedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      },
      select: { actionType: true, completedAt: true },
    });
    return runs
      .filter((run): run is typeof run & { completedAt: Date } => run.completedAt !== null)
      .map((run) => ({
        actionType: run.actionType,
        executedAt: run.completedAt,
      }));
  },
};
