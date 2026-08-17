import { prisma } from "@/lib/database/prisma";
import type { DomainEvent } from "@/lib/domain-events/constants";
import {
  readLeadIdFromPayload,
  readStoredPayload,
  toInputJsonValue,
} from "@/lib/domain-events/payload";
import { mapDomainEventToAutomation } from "@/lib/domain-events/map-to-automation";
import { automationEngineExecutionService } from "@/server/services/automation-engine-execution-service";
import { marketingAutomationEnrollmentService } from "@/server/services/marketing-automation-enrollment-service";
import type { OrganisationRole } from "@prisma/client";

const SYSTEM_ACTOR = "system-domain-events";

function systemTenant(organisationId: string) {
  return {
    userId: SYSTEM_ACTOR,
    userProfileId: SYSTEM_ACTOR,
    organisationId,
    organisationRole: "OWNER" as OrganisationRole,
  };
}

/**
 * Emits a domain event and schedules automation dispatch asynchronously.
 * Event emission occurs only after the caller has persisted authoritative state.
 */
export const domainEventService = {
  async emit(event: DomainEvent): Promise<{ dispatched: boolean; automationEventType: string | null }> {
    const automationEventType = mapDomainEventToAutomation(event.type);

    const existing = await prisma.domainEventOutbox.findUnique({
      where: { idempotencyKey: event.idempotencyKey },
    });
    if (existing) {
      return { dispatched: existing.status === "PENDING", automationEventType };
    }

    await prisma.domainEventOutbox.create({
      data: {
        organisationId: event.organisationId,
        projectId: event.projectId,
        brandId: event.brandId,
        eventType: event.type,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        payload: toInputJsonValue(event.payload),
        idempotencyKey: event.idempotencyKey,
        correlationId: event.correlationId,
        causationId: event.causationId,
        occurredAt: event.occurredAt ?? new Date(),
        status: automationEventType ? "PENDING" : "NO_AUTOMATION",
      },
    });

    if (!automationEventType) {
      return { dispatched: false, automationEventType: null };
    }

    void this.processPendingForBrand(event.brandId, event.organisationId).catch(() => undefined);
    return { dispatched: true, automationEventType };
  },

  async processPendingForBrand(brandId: string, organisationId: string, limit = 25) {
    const pending = await prisma.domainEventOutbox.findMany({
      where: { brandId, organisationId, status: "PENDING" },
      orderBy: { occurredAt: "asc" },
      take: limit,
    });

    const tenant = systemTenant(organisationId);
    const results = [];

    for (const row of pending) {
      const automationEventType = mapDomainEventToAutomation(row.eventType as DomainEvent["type"]);
      if (!automationEventType) {
        await prisma.domainEventOutbox.update({
          where: { id: row.id },
          data: { status: "NO_AUTOMATION", processedAt: new Date() },
        });
        continue;
      }

      try {
        const storedPayload = readStoredPayload(row.payload);
        const payload = {
          ...storedPayload,
          resourceType: row.resourceType,
          resourceId: row.resourceId,
          domainEventType: row.eventType,
          correlationId: row.correlationId,
          causationId: row.causationId,
        };

        const engineResult = await automationEngineExecutionService.dispatchEvent(
          brandId,
          organisationId,
          {
            eventType: automationEventType,
            payload,
            idempotencyKey: row.idempotencyKey,
            triggerDepth: row.causationId ? 1 : 0,
          },
          tenant,
        );

        if (row.eventType === "lead.created" || row.eventType === "lead.qualified") {
          const leadId = readLeadIdFromPayload(storedPayload, row.resourceId);
          const triggerType = row.eventType === "lead.qualified" ? "LEAD_STATUS_CHANGED" : "LEAD_CREATED";
          await marketingAutomationEnrollmentService.processTriggerEvent(
            brandId,
            organisationId,
            {
              type: triggerType,
              occurredAt: row.occurredAt,
              payload: payload,
              leadId,
              triggerEventId: row.idempotencyKey,
            },
            tenant,
          );
        }

        await prisma.domainEventOutbox.update({
          where: { id: row.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            automationResult: engineResult as object,
          },
        });
        results.push({ id: row.id, status: "PROCESSED" });
      } catch (error) {
        await prisma.domainEventOutbox.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            processedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Dispatch failed.",
          },
        });
        results.push({ id: row.id, status: "FAILED" });
      }
    }

    return { processed: results.length, results };
  },
};
