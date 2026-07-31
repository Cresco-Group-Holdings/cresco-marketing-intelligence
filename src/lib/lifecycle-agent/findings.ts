import {
  LOW_ENGAGEMENT_DAYS,
  RENEWAL_APPROACHING_DAYS,
  STALE_CRM_DATA_HOURS,
  STALE_LEAD_DAYS,
  STALE_OPPORTUNITY_DAYS,
  TRIAL_ENDING_WARNING_DAYS,
} from "./constants";
import type { LifecycleAnalysisInput } from "./analysis-inputs";
import type { EvidencePackage } from "./evidence";

export type FindingCandidate = {
  findingType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  entityType: "lead" | "opportunity" | "portfolio";
  entityId: string | null;
  suppressed: boolean;
  suppressionReason: string | null;
  evidence: Record<string, unknown>;
};

export function detectFindings(
  input: LifecycleAnalysisInput,
  evidence: EvidencePackage,
): FindingCandidate[] {
  const findings: FindingCandidate[] = [];
  const now = input.analysisDate;
  const insufficientData = evidence.dataConfidenceLevel === "LOW";
  const suppressionReason = insufficientData
    ? "Insufficient CRM data confidence for reliable finding."
    : null;

  if (evidence.freshnessHours !== null && evidence.freshnessHours > STALE_CRM_DATA_HOURS) {
    findings.push({
      findingType: "DATA_STALE",
      severity: "WARNING",
      title: "Stale CRM data",
      description: `CRM data freshness is ${evidence.freshnessHours}h (threshold ${STALE_CRM_DATA_HOURS}h).`,
      entityType: "portfolio",
      entityId: null,
      suppressed: false,
      suppressionReason: null,
      evidence: { freshnessHours: evidence.freshnessHours },
    });
  }

  if (input.dataQuality.activityCount < 1) {
    findings.push({
      findingType: "INSUFFICIENT_CRM_DATA",
      severity: "INFO",
      title: "Insufficient CRM activity data",
      description: "No logged activities in scope. Findings may be limited.",
      entityType: "portfolio",
      entityId: null,
      suppressed: true,
      suppressionReason: suppressionReason,
      evidence: { activityCount: input.dataQuality.activityCount },
    });
  }

  for (const lead of input.leads) {
    if (!lead.ownerUserId) {
      findings.push({
        findingType: "NO_OWNER",
        severity: "WARNING",
        title: "Lead without owner",
        description: `Lead ${lead.id} has no assigned owner.`,
        entityType: "lead",
        entityId: lead.id,
        suppressed: insufficientData,
        suppressionReason,
        evidence: { leadId: lead.id, status: lead.status },
      });
    }

    if (lead.suppressed || lead.unsubscribed) {
      findings.push({
        findingType: "SUPPRESSED_CONTACT",
        severity: "INFO",
        title: "Suppressed or unsubscribed contact",
        description: `Lead ${lead.id} is suppressed or unsubscribed. Outreach restricted.`,
        entityType: "lead",
        entityId: lead.id,
        suppressed: false,
        suppressionReason: null,
        evidence: { leadId: lead.id, suppressed: lead.suppressed, unsubscribed: lead.unsubscribed },
      });
    }

    if (lead.consentGranted === false || (input.consentContext?.marketingConsentRequired && !lead.marketingConsent)) {
      findings.push({
        findingType: "CONSENT_RESTRICTED",
        severity: "WARNING",
        title: "Consent restricts outreach",
        description: `Lead ${lead.id} lacks required consent for marketing outreach.`,
        entityType: "lead",
        entityId: lead.id,
        suppressed: false,
        suppressionReason: null,
        evidence: { leadId: lead.id, consentGranted: lead.consentGranted },
      });
    }

    if (lead.lastActivityAt) {
      const inactiveDays = (now.getTime() - lead.lastActivityAt.getTime()) / 86_400_000;
      if (inactiveDays > STALE_LEAD_DAYS) {
        findings.push({
          findingType: "STALE_LEAD",
          severity: "WARNING",
          title: "Stale lead",
          description: `Lead ${lead.id} has no activity for ${Math.round(inactiveDays)} days.`,
          entityType: "lead",
          entityId: lead.id,
          suppressed: insufficientData,
          suppressionReason,
          evidence: { leadId: lead.id, inactiveDays: Math.round(inactiveDays) },
        });
      }
      if (inactiveDays > LOW_ENGAGEMENT_DAYS) {
        findings.push({
          findingType: "LOW_ENGAGEMENT",
          severity: "INFO",
          title: "Low engagement",
          description: `Lead ${lead.id} shows low recent engagement (${Math.round(inactiveDays)} days since last activity).`,
          entityType: "lead",
          entityId: lead.id,
          suppressed: insufficientData,
          suppressionReason,
          evidence: { leadId: lead.id, inactiveDays: Math.round(inactiveDays) },
        });
      }
    }

    if ((lead.overdueTaskCount ?? 0) > 0) {
      findings.push({
        findingType: "OVERDUE_TASK",
        severity: "WARNING",
        title: "Overdue tasks on lead",
        description: `Lead ${lead.id} has ${lead.overdueTaskCount} overdue task(s).`,
        entityType: "lead",
        entityId: lead.id,
        suppressed: false,
        suppressionReason: null,
        evidence: { leadId: lead.id, overdueTaskCount: lead.overdueTaskCount },
      });
    }

    if (lead.churnLikelihoodEstimate !== undefined && lead.churnLikelihoodEstimate >= 0.7) {
      findings.push({
        findingType: "CHURN_SIGNAL",
        severity: "WARNING",
        title: "Elevated churn likelihood estimate",
        description: `Lead ${lead.id} shows elevated churn likelihood (${(lead.churnLikelihoodEstimate * 100).toFixed(0)}%). This is a heuristic estimate, not a proven fact.`,
        entityType: "lead",
        entityId: lead.id,
        suppressed: insufficientData,
        suppressionReason,
        evidence: {
          leadId: lead.id,
          churnLikelihoodEstimate: lead.churnLikelihoodEstimate,
          disclaimer: evidence.churnLikelihoodDisclaimer,
        },
      });
    }

    if (lead.leadScore !== undefined && lead.leadScore >= 70 && (lead.openTaskCount ?? 0) === 0) {
      findings.push({
        findingType: "STRONG_ENGAGEMENT",
        severity: "INFO",
        title: "High-scoring lead without open task",
        description: `Lead ${lead.id} scores ${lead.leadScore} but has no open follow-up task.`,
        entityType: "lead",
        entityId: lead.id,
        suppressed: insufficientData,
        suppressionReason,
        evidence: { leadId: lead.id, leadScore: lead.leadScore },
      });
    }
  }

  for (const opp of input.opportunities) {
    if (opp.status !== "OPEN") continue;

    if (!opp.nextAction?.trim()) {
      findings.push({
        findingType: "NO_NEXT_ACTION",
        severity: "WARNING",
        title: "No next action defined",
        description: `Opportunity ${opp.name} has no next action.`,
        entityType: "opportunity",
        entityId: opp.id,
        suppressed: insufficientData,
        suppressionReason,
        evidence: { opportunityId: opp.id, name: opp.name },
      });
    }

    if ((opp.overdueTaskCount ?? 0) > 0) {
      findings.push({
        findingType: "OVERDUE_TASK",
        severity: "WARNING",
        title: "Overdue tasks on opportunity",
        description: `Opportunity ${opp.name} has ${opp.overdueTaskCount} overdue task(s).`,
        entityType: "opportunity",
        entityId: opp.id,
        suppressed: false,
        suppressionReason: null,
        evidence: { opportunityId: opp.id, overdueTaskCount: opp.overdueTaskCount },
      });
    }

    if (opp.lastActivityAt) {
      const staleDays = (now.getTime() - opp.lastActivityAt.getTime()) / 86_400_000;
      if (staleDays > STALE_OPPORTUNITY_DAYS) {
        findings.push({
          findingType: "STALE_OPPORTUNITY",
          severity: "WARNING",
          title: "Stale opportunity",
          description: `Opportunity ${opp.name} has no activity for ${Math.round(staleDays)} days.`,
          entityType: "opportunity",
          entityId: opp.id,
          suppressed: insufficientData,
          suppressionReason,
          evidence: { opportunityId: opp.id, staleDays: Math.round(staleDays) },
        });
      }
    }

    if (opp.expectedCloseDate && opp.expectedCloseDate < now) {
      findings.push({
        findingType: "CLOSE_DATE_PASSED",
        severity: "CRITICAL",
        title: "Close date passed",
        description: `Opportunity ${opp.name} expected close date has passed.`,
        entityType: "opportunity",
        entityId: opp.id,
        suppressed: false,
        suppressionReason: null,
        evidence: { opportunityId: opp.id, expectedCloseDate: opp.expectedCloseDate.toISOString() },
      });
    }

    if (!opp.hasDecisionMaker) {
      findings.push({
        findingType: "MISSING_DECISION_MAKER",
        severity: "INFO",
        title: "Missing decision maker",
        description: `Opportunity ${opp.name} has no decision-maker contact assigned.`,
        entityType: "opportunity",
        entityId: opp.id,
        suppressed: insufficientData,
        suppressionReason,
        evidence: { opportunityId: opp.id },
      });
    }

    if (!opp.expectedValue || opp.expectedValue <= 0) {
      findings.push({
        findingType: "MISSING_VALUE",
        severity: "WARNING",
        title: "Expected value not set",
        description: `Opportunity ${opp.name} has no expected value.`,
        entityType: "opportunity",
        entityId: opp.id,
        suppressed: insufficientData,
        suppressionReason,
        evidence: { opportunityId: opp.id },
      });
    }

    if (opp.maxDurationDays && opp.stageEnteredAt) {
      const stageDays = (now.getTime() - opp.stageEnteredAt.getTime()) / 86_400_000;
      if (stageDays > opp.maxDurationDays) {
        findings.push({
          findingType: "STAGE_DURATION_EXCEEDED",
          severity: "WARNING",
          title: "Stage duration exceeded",
          description: `Opportunity ${opp.name} has been in stage ${Math.round(stageDays)} days (max ${opp.maxDurationDays}).`,
          entityType: "opportunity",
          entityId: opp.id,
          suppressed: insufficientData,
          suppressionReason,
          evidence: { opportunityId: opp.id, stageDays: Math.round(stageDays) },
        });
      }
    }

    if ((opp.stageReversalCount ?? 0) > 1) {
      findings.push({
        findingType: "STAGE_REVERSAL",
        severity: "INFO",
        title: "Repeated stage reversal",
        description: `Opportunity ${opp.name} has repeated backward stage movement.`,
        entityType: "opportunity",
        entityId: opp.id,
        suppressed: insufficientData,
        suppressionReason,
        evidence: { opportunityId: opp.id, stageReversalCount: opp.stageReversalCount },
      });
    }

    if (opp.trialEndsAt) {
      const daysUntilTrialEnd = (opp.trialEndsAt.getTime() - now.getTime()) / 86_400_000;
      if (daysUntilTrialEnd >= 0 && daysUntilTrialEnd <= TRIAL_ENDING_WARNING_DAYS) {
        findings.push({
          findingType: "TRIAL_ENDING_SOON",
          severity: "WARNING",
          title: "Trial ending soon",
          description: `Opportunity ${opp.name} trial ends in ${Math.round(daysUntilTrialEnd)} days.`,
          entityType: "opportunity",
          entityId: opp.id,
          suppressed: false,
          suppressionReason: null,
          evidence: { opportunityId: opp.id, trialEndsAt: opp.trialEndsAt.toISOString(), daysRemaining: Math.round(daysUntilTrialEnd) },
        });
      }
      if (daysUntilTrialEnd >= 0 && daysUntilTrialEnd <= TRIAL_ENDING_WARNING_DAYS && opp.lastActivityAt) {
        const inactiveDays = (now.getTime() - opp.lastActivityAt.getTime()) / 86_400_000;
        if (inactiveDays > 7) {
          findings.push({
            findingType: "TRIAL_INACTIVE",
            severity: "CRITICAL",
            title: "Inactive trial",
            description: `Opportunity ${opp.name} trial is ending soon but has been inactive for ${Math.round(inactiveDays)} days.`,
            entityType: "opportunity",
            entityId: opp.id,
            suppressed: false,
            suppressionReason: null,
            evidence: { opportunityId: opp.id, inactiveDays: Math.round(inactiveDays) },
          });
        }
      }
    }

    if (opp.renewalDate) {
      const daysUntilRenewal = (opp.renewalDate.getTime() - now.getTime()) / 86_400_000;
      if (daysUntilRenewal >= 0 && daysUntilRenewal <= RENEWAL_APPROACHING_DAYS) {
        findings.push({
          findingType: "RENEWAL_APPROACHING",
          severity: "INFO",
          title: "Renewal approaching",
          description: `Opportunity ${opp.name} renewal in ${Math.round(daysUntilRenewal)} days.`,
          entityType: "opportunity",
          entityId: opp.id,
          suppressed: false,
          suppressionReason: null,
          evidence: { opportunityId: opp.id, renewalDate: opp.renewalDate.toISOString() },
        });
      }
      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 14 && opp.lastActivityAt) {
        const inactiveDays = (now.getTime() - opp.lastActivityAt.getTime()) / 86_400_000;
        if (inactiveDays > 14) {
          findings.push({
            findingType: "RENEWAL_AT_RISK",
            severity: "WARNING",
            title: "Renewal at risk",
            description: `Opportunity ${opp.name} renewal is imminent but engagement is low.`,
            entityType: "opportunity",
            entityId: opp.id,
            suppressed: insufficientData,
            suppressionReason,
            evidence: { opportunityId: opp.id, daysUntilRenewal: Math.round(daysUntilRenewal), inactiveDays: Math.round(inactiveDays) },
          });
        }
      }
    }
  }

  if (
    evidence.openOpportunityCount > 0 &&
    evidence.overdueTaskCount === 0 &&
    evidence.staleOpportunityCount === 0 &&
    !insufficientData
  ) {
    findings.push({
      findingType: "HEALTHY_PIPELINE",
      severity: "INFO",
      title: "Healthy pipeline",
      description: `${evidence.openOpportunityCount} open opportunities with no overdue tasks or stale records.`,
      entityType: "portfolio",
      entityId: null,
      suppressed: false,
      suppressionReason: null,
      evidence: { openOpportunityCount: evidence.openOpportunityCount },
    });
  }

  return findings;
}
