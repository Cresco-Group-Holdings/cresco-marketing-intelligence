import type { CrmFollowUpRuleTrigger, CrmTaskTypeCode } from "@prisma/client";

export type FollowUpCandidate = {
  trigger: CrmFollowUpRuleTrigger;
  entityType: "lead" | "opportunity" | "meeting" | "submission";
  entityId: string;
  title: string;
  description?: string;
  recommendedTaskType: CrmTaskTypeCode;
  dueOffsetHours: number;
  evidence: Record<string, unknown>;
};

export type LeadContext = {
  id: string;
  status: string;
  qualificationState: string;
  ownerUserId: string | null;
  lastActivityAt: Date | null;
  hasOpenTask: boolean;
  hasDemoRequest: boolean;
  hasRecentReply: boolean;
  hasResponseTask: boolean;
};

export type OpportunityContext = {
  id: string;
  name: string;
  status: string;
  stageCategory?: string;
  lastActivityAt: Date;
  nextAction: string | null;
  hasOpenTask: boolean;
  expectedCloseDate: Date | null;
  trialEndsAt?: Date | null;
};

export type MeetingContext = {
  id: string;
  opportunityId?: string;
  leadId?: string;
  outcome?: string | null;
  hasFollowUpTask: boolean;
  completedAt: Date;
};

const HOURS = 3_600_000;
const DAYS = 86_400_000;

export function evaluateLeadRules(lead: LeadContext, now = new Date()): FollowUpCandidate[] {
  const candidates: FollowUpCandidate[] = [];

  if (!lead.ownerUserId) {
    candidates.push({
      trigger: "NEW_LEAD_NO_OWNER",
      entityType: "lead",
      entityId: lead.id,
      title: "Assign lead owner",
      description: "Lead has no assigned owner.",
      recommendedTaskType: "REVIEW",
      dueOffsetHours: 4,
      evidence: { leadId: lead.id, status: lead.status },
    });
  }

  if (lead.qualificationState === "QUALIFIED" && !lead.hasOpenTask) {
    candidates.push({
      trigger: "QUALIFIED_LEAD_NO_TASK",
      entityType: "lead",
      entityId: lead.id,
      title: "Create follow-up for qualified lead",
      recommendedTaskType: "FOLLOW_UP",
      dueOffsetHours: 24,
      evidence: { leadId: lead.id, qualificationState: lead.qualificationState },
    });
  }

  if (lead.hasDemoRequest && lead.lastActivityAt && now.getTime() - lead.lastActivityAt.getTime() > 24 * HOURS) {
    candidates.push({
      trigger: "DEMO_REQUEST_NOT_CONTACTED",
      entityType: "lead",
      entityId: lead.id,
      title: "Contact demo request lead",
      recommendedTaskType: "DEMO",
      dueOffsetHours: 4,
      evidence: { leadId: lead.id, lastActivityAt: lead.lastActivityAt.toISOString() },
    });
  }

  if (lead.hasRecentReply && !lead.hasResponseTask) {
    candidates.push({
      trigger: "LEAD_REPLIED_NO_TASK",
      entityType: "lead",
      entityId: lead.id,
      title: "Respond to lead reply",
      recommendedTaskType: "EMAIL",
      dueOffsetHours: 4,
      evidence: { leadId: lead.id },
    });
  }

  return candidates;
}

export function evaluateOpportunityRules(opp: OpportunityContext, now = new Date()): FollowUpCandidate[] {
  const candidates: FollowUpCandidate[] = [];
  const inactiveThreshold = 14 * DAYS;

  if (opp.status === "OPEN" && now.getTime() - opp.lastActivityAt.getTime() > inactiveThreshold) {
    candidates.push({
      trigger: "OPPORTUNITY_INACTIVE",
      entityType: "opportunity",
      entityId: opp.id,
      title: `Re-engage inactive opportunity: ${opp.name}`,
      recommendedTaskType: "FOLLOW_UP",
      dueOffsetHours: 24,
      evidence: { opportunityId: opp.id, lastActivityAt: opp.lastActivityAt.toISOString() },
    });
  }

  if (opp.stageCategory === "PROPOSAL" && !opp.hasOpenTask) {
    candidates.push({
      trigger: "PROPOSAL_NO_FOLLOW_UP",
      entityType: "opportunity",
      entityId: opp.id,
      title: `Follow up on proposal: ${opp.name}`,
      recommendedTaskType: "FOLLOW_UP",
      dueOffsetHours: 48,
      evidence: { opportunityId: opp.id, stageCategory: opp.stageCategory },
    });
  }

  if (opp.trialEndsAt) {
    const daysUntilTrialEnd = (opp.trialEndsAt.getTime() - now.getTime()) / DAYS;
    if (daysUntilTrialEnd > 0 && daysUntilTrialEnd <= 7) {
      candidates.push({
        trigger: "TRIAL_ENDING",
        entityType: "opportunity",
        entityId: opp.id,
        title: `Trial ending soon: ${opp.name}`,
        recommendedTaskType: "CALL",
        dueOffsetHours: 24,
        evidence: { opportunityId: opp.id, trialEndsAt: opp.trialEndsAt.toISOString() },
      });
    }
  }

  if (opp.expectedCloseDate) {
    const daysUntilClose = (opp.expectedCloseDate.getTime() - now.getTime()) / DAYS;
    if (daysUntilClose > 0 && daysUntilClose <= 30) {
      candidates.push({
        trigger: "RENEWAL_APPROACHING",
        entityType: "opportunity",
        entityId: opp.id,
        title: `Renewal approaching: ${opp.name}`,
        recommendedTaskType: "RENEWAL",
        dueOffsetHours: 48,
        evidence: { opportunityId: opp.id, expectedCloseDate: opp.expectedCloseDate.toISOString() },
      });
    }
  }

  return candidates;
}

export function evaluateMeetingRules(meeting: MeetingContext): FollowUpCandidate[] {
  if (meeting.hasFollowUpTask || !meeting.outcome) return [];
  return [
    {
      trigger: "MEETING_NO_NEXT_STEP",
      entityType: "meeting",
      entityId: meeting.id,
      title: "Create next step after meeting",
      description: "Meeting completed without a follow-up task.",
      recommendedTaskType: "FOLLOW_UP",
      dueOffsetHours: 24,
      evidence: {
        meetingId: meeting.id,
        opportunityId: meeting.opportunityId,
        leadId: meeting.leadId,
        completedAt: meeting.completedAt.toISOString(),
      },
    },
  ];
}

export function computeDueAt(offsetHours: number, from = new Date()): Date {
  return new Date(from.getTime() + offsetHours * HOURS);
}
