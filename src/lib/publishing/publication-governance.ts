import type { PublicationOperationType, PublicationStatus } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import type { OrganisationRole } from "@prisma/client";
import {
  BUDGET_OPERATIONS,
  operationToCapability,
  WRITE_OPERATIONS_REQUIRING_APPROVAL,
  type OutboundOperationType,
} from "@/lib/publishing/outbound-operations";
import type { ContentAdaptationResult } from "@/lib/publishing/content-adaptation";

export type GovernanceCheckInput = {
  organisationRole: OrganisationRole;
  operationType: PublicationOperationType;
  contentStatus: string;
  compliancePassed: boolean;
  complianceOverridden: boolean;
  assetsReady: boolean;
  connectionStatus: string;
  connectionRevoked: boolean;
  externalAccountId: string;
  destinationAccountId: string;
  scheduledFor?: Date | null;
  timezone: string;
  adaptation: ContentAdaptationResult;
  budgetApproved?: boolean;
  humanApprovalRequired: boolean;
  publicationApproved: boolean;
  emergencyShutdown: boolean;
};

export type GovernanceCheckResult = {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  requiresApproval: boolean;
  requiresBudgetApproval: boolean;
};

const EXECUTABLE_CONNECTION_STATUSES = new Set(["CONNECTED", "DEGRADED"]);

export function evaluatePublicationGovernance(input: GovernanceCheckInput): GovernanceCheckResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.emergencyShutdown) {
    blockers.push("Publishing emergency shutdown is active.");
  }

  if (input.contentStatus !== "APPROVED") {
    blockers.push("Content must be approved before publication.");
  }

  if (!input.compliancePassed && !input.complianceOverridden) {
    blockers.push("Compliance checks must pass or be explicitly overridden.");
  }

  if (!input.assetsReady) {
    blockers.push("Required assets are not ready.");
  }

  const publishPermission = BUDGET_OPERATIONS.has(input.operationType as OutboundOperationType)
    ? PERMISSIONS["advertisingBudgets.manage"]
    : PERMISSIONS["content.publish"];

  if (!hasPermission(input.organisationRole, publishPermission)) {
    blockers.push("Insufficient permission for this publication operation.");
  }

  if (input.connectionRevoked) {
    blockers.push("Provider connection has been revoked.");
  }

  if (!EXECUTABLE_CONNECTION_STATUSES.has(input.connectionStatus)) {
    blockers.push(`Connection is not ready (status: ${input.connectionStatus}).`);
  }

  if (input.externalAccountId !== input.destinationAccountId) {
    blockers.push("Destination account does not belong to this connection.");
  }

  if (input.scheduledFor && input.scheduledFor <= new Date()) {
    blockers.push("Scheduled time must be in the future.");
  }

  if (!input.timezone) {
    blockers.push("Timezone is required for scheduled publications.");
  }

  for (const issue of input.adaptation.issues) {
    blockers.push(issue.message);
  }

  for (const warning of input.adaptation.warnings) {
    warnings.push(warning.message);
  }

  const requiresApproval =
    input.humanApprovalRequired ||
    WRITE_OPERATIONS_REQUIRING_APPROVAL.has(input.operationType as OutboundOperationType);

  if (requiresApproval && !input.publicationApproved) {
    blockers.push("Human approval is required before execution.");
  }

  const requiresBudgetApproval = BUDGET_OPERATIONS.has(input.operationType as OutboundOperationType);
  if (requiresBudgetApproval && !input.budgetApproved) {
    blockers.push("Budget change requires approval.");
  }

  if (!input.adaptation.valid) {
    blockers.push("Provider format validation failed.");
  }

  // Capability scope placeholder — real scope checks happen at gateway
  void operationToCapability(input.operationType as OutboundOperationType);

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    requiresApproval,
    requiresBudgetApproval,
  };
}

export const TERMINAL_PUBLICATION_STATUSES = new Set<PublicationStatus>([
  "PUBLISHED",
  "PARTIALLY_PUBLISHED",
  "FAILED",
  "CANCELLED",
  "REMOVED",
]);

export function canCancelPublication(status: PublicationStatus): boolean {
  return ["DRAFT", "PENDING_APPROVAL", "APPROVED", "QUEUED", "SCHEDULED"].includes(status);
}

export function canRetryPublication(status: PublicationStatus): boolean {
  return status === "FAILED" || status === "PARTIALLY_PUBLISHED" || status === "REQUIRES_REAUTH";
}
