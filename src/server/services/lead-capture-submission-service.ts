import { OrganisationRole, type Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "@/lib/database/prisma";
import { buildAttributionRecord, buildIdempotencyKey } from "@/lib/lead-capture-forms/attribution";
import { validateConsentSubmissions } from "@/lib/lead-capture-forms/consent";
import {
  rejectUnknownFields,
  validateSubmissionValue,
  type FormFieldDefinition,
} from "@/lib/lead-capture-forms/field-validation";
import { evaluateRoutingRules } from "@/lib/lead-capture-forms/routing";
import { assessSpam } from "@/lib/lead-capture-forms/spam";
import { hashClientIp, validateOrigin } from "@/lib/lead-capture-forms/security";
import { MAX_FIELD_COUNT, MAX_SUBMISSION_PAYLOAD_BYTES } from "@/lib/lead-capture-forms/constants";
import { AppError } from "@/lib/errors";
import { crmService } from "@/server/services/crm-service";
import { leadCaptureFormService } from "@/server/services/lead-capture-form-service";

export type SubmitFormInput = {
  fields: Record<string, unknown>;
  consent?: Array<{ purpose: string; granted: boolean; wordingVersion: string }>;
  idempotencyKey?: string;
  attribution?: {
    pageUrl?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    campaignId?: string;
    adClickId?: string;
    socialContentId?: string;
    anonymousId?: string;
    sessionId?: string;
    trackingPropertyId?: string;
  };
};

export type SubmitContext = {
  origin: string | null;
  clientIp: string;
  userAgent: string | null;
  velocityExceeded?: boolean;
};

function mapFormTypeToSource(formType: string): string {
  const map: Record<string, string> = {
    GRANT_INTEREST: "GRANT_INTEREST",
    CAPITAL_ANALYSIS_REQUEST: "CAPITAL_ANALYSIS_INTEREST",
    DEMO_REQUEST: "DEMO_REQUEST",
    NEWSLETTER: "WEBSITE_FORM",
    CONTACT: "WEBSITE_FORM",
  };
  return map[formType] ?? "WEBSITE_FORM";
}

function extractEmailPhone(fields: Record<string, unknown>, fieldDefs: FormFieldDefinition[]) {
  let email: string | undefined;
  let phone: string | undefined;
  let firstName: string | undefined;
  let company: string | undefined;
  for (const def of fieldDefs) {
    const val = fields[def.fieldKey];
    if (val === undefined || val === null) continue;
    if (def.fieldType === "EMAIL") email = String(val);
    if (def.fieldType === "PHONE") phone = String(val);
    if (def.fieldKey === "first_name" || def.fieldKey === "firstName") firstName = String(val);
    if (def.fieldType === "COMPANY") company = String(val);
  }
  return { email, phone, firstName, company };
}

export const leadCaptureSubmissionService = {
  async submit(publicFormId: string, input: SubmitFormInput, ctx: SubmitContext) {
    const payloadSize = JSON.stringify(input).length;
    if (payloadSize > MAX_SUBMISSION_PAYLOAD_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Payload too large.");
    }

    const form = await leadCaptureFormService.getFormByPublicId(publicFormId);
    if (form.status !== "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "Form is not active.");
    }

    const version = form.versions[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "No active form version.");

    const originOk = validateOrigin(ctx.origin, form.allowedOrigins);
    const fieldDefs: FormFieldDefinition[] = version.fields.map((f) => ({
      fieldKey: f.fieldKey,
      fieldType: f.fieldType,
      label: f.label,
      isRequired: f.isRequired,
      isHoneypot: f.isHoneypot,
      options: f.options.map((o) => ({ value: o.value, label: o.label })),
    }));

    if (fieldDefs.length > MAX_FIELD_COUNT) {
      throw new AppError("VALIDATION_ERROR", "Too many fields.");
    }

    const unknownCheck = rejectUnknownFields(
      Object.keys(input.fields),
      fieldDefs.map((f) => f.fieldKey),
    );
    if (!unknownCheck.valid) {
      throw new AppError("VALIDATION_ERROR", `Unknown fields: ${unknownCheck.unknown.join(", ")}`);
    }

    const honeypotFilled = fieldDefs.some((f) => f.isHoneypot && input.fields[f.fieldKey]);

    for (const def of fieldDefs) {
      const result = validateSubmissionValue(def, input.fields[def.fieldKey]);
      if (!result.valid) throw new AppError("VALIDATION_ERROR", result.error ?? "Validation failed");
    }

    const consentBlocks = version.consentBlocks.map((b) => ({
      purpose: b.purpose,
      isRequired: b.isRequired,
      wordingVersion: b.wordingVersion,
    }));
    const consentCheck = validateConsentSubmissions(consentBlocks, input.consent ?? []);
    if (!consentCheck.valid) {
      throw new AppError("VALIDATION_ERROR", consentCheck.errors.join(" "));
    }

    const idempotencyKey = input.idempotencyKey
      ? buildIdempotencyKey(form.id, input.idempotencyKey)
      : undefined;

    if (idempotencyKey) {
      const existing = await prisma.leadCaptureSubmission.findUnique({
        where: { formId_idempotencyKey: { formId: form.id, idempotencyKey } },
      });
      if (existing) {
        return { submissionId: existing.id, status: existing.status, duplicate: true };
      }
    }

    const spam = assessSpam({
      honeypotFilled,
      originMismatch: !originOk,
      velocityExceeded: ctx.velocityExceeded,
      duplicateSubmission: false,
    });

    const attribution = buildAttributionRecord(input.attribution ?? {}, version.id);
    const submissionStatus =
      spam.verdict === "QUARANTINED" ? "QUARANTINED" : spam.verdict === "SUSPICIOUS" ? "QUARANTINED" : "PROCESSING";

    const submission = await prisma.$transaction(async (tx) => {
      const sub = await tx.leadCaptureSubmission.create({
        data: {
          organisationId: form.organisationId,
          projectId: form.projectId,
          brandId: form.brandId,
          formId: form.id,
          formVersionId: version.id,
          status: submissionStatus,
          idempotencyKey,
          receiptAt: new Date(),
          pageUrl: attribution.pageUrl,
          referrer: attribution.referrer,
          utmSource: attribution.utmSource,
          utmMedium: attribution.utmMedium,
          utmCampaign: attribution.utmCampaign,
          utmTerm: attribution.utmTerm,
          utmContent: attribution.utmContent,
          campaignId: attribution.campaignId,
          adClickId: attribution.adClickId,
          socialContentId: attribution.socialContentId,
          anonymousId: attribution.anonymousId,
          sessionId: attribution.sessionId,
          trackingPropertyId: attribution.trackingPropertyId,
          origin: ctx.origin,
          clientIpHash: hashClientIp(ctx.clientIp),
          userAgent: ctx.userAgent?.slice(0, 512) ?? null,
        },
      });

      for (const field of version.fields) {
        const val = input.fields[field.fieldKey];
        if (val === undefined || field.isHoneypot) continue;
        await tx.leadCaptureSubmissionValue.create({
          data: {
            submissionId: sub.id,
            fieldId: field.id,
            fieldKey: field.fieldKey,
            valueText: typeof val === "string" ? val : JSON.stringify(val),
            valueJson: typeof val === "object" ? (val as Prisma.InputJsonValue) : undefined,
          },
        });
      }

      for (const record of consentCheck.records) {
        await tx.leadCaptureSubmissionConsent.create({
          data: {
            submissionId: sub.id,
            purpose: record.purpose as Prisma.LeadCaptureSubmissionConsentCreateInput["purpose"],
            state: record.granted ? "GRANTED" : "DENIED",
            wordingVersion: record.wordingVersion,
            formVersionId: version.id,
          },
        });
      }

      await tx.leadCaptureSpamAssessment.create({
        data: {
          submissionId: sub.id,
          verdict: spam.verdict,
          signals: spam.signals as Prisma.InputJsonValue,
          score: spam.score,
        },
      });

      return sub;
    });

    if (submissionStatus === "QUARANTINED") {
      return { submissionId: submission.id, status: "QUARANTINED", quarantined: true };
    }

    const { email, phone, firstName, company } = extractEmailPhone(input.fields, fieldDefs);
    const rules = await prisma.leadCaptureRule.findMany({
      where: { formId: form.id, isActive: true },
      orderBy: { priority: "asc" },
    });
    const matchedRule = evaluateRoutingRules(
      rules.map((r) => ({
        name: r.name,
        priority: r.priority,
        conditions: r.conditions as Array<{ field?: string; operator: "eq" | "neq" | "in" | "exists"; value?: string | string[] }>,
        actionType: r.actionType,
        actionConfig: r.actionConfig as Record<string, unknown>,
      })),
      {
        formType: form.formType,
        brandId: form.brandId,
        fieldValues: Object.fromEntries(
          Object.entries(input.fields).map(([k, v]) => [k, String(v)]),
        ),
      },
    );

    const systemContext = {
      userProfileId: form.createdByUserId,
      userId: "system",
      organisationId: form.organisationId,
      organisationRole: OrganisationRole.OWNER,
    };

    const lead = await crmService.createLead(
      form.brandId,
      form.organisationId,
      {
        sourceType: mapFormTypeToSource(form.formType),
        primaryProductInterest: (matchedRule?.actionConfig?.productInterest as string) ?? form.formType,
        person: {
          displayName: firstName,
          contactMethods: [
            ...(email ? [{ methodType: "EMAIL", value: email, isPrimary: true }] : []),
            ...(phone ? [{ methodType: "PHONE", value: phone }] : []),
          ],
        },
        source: {
          formName: form.name,
          landingPage: attribution.pageUrl ?? undefined,
          utmSource: attribution.utmSource ?? undefined,
          utmMedium: attribution.utmMedium ?? undefined,
          utmCampaign: attribution.utmCampaign ?? undefined,
        },
        ownerUserId: matchedRule?.actionType === "ASSIGN_OWNER" ? (matchedRule.actionConfig.ownerUserId as string) : undefined,
        companyId: undefined,
      },
      systemContext,
    );

    if (matchedRule?.actionType === "ASSIGN_OWNER" && matchedRule.actionConfig.ownerUserId) {
      await crmService.assignOwner(
        lead.id,
        form.brandId,
        form.organisationId,
        matchedRule.actionConfig.ownerUserId as string,
        systemContext,
      );
    }

    await prisma.leadCaptureSubmission.update({
      where: { id: submission.id },
      data: { status: "ACCEPTED", crmLeadId: lead.id },
    });

    await prisma.crmActivityTimelineItem.create({
      data: {
        organisationId: form.organisationId,
        brandId: form.brandId,
        leadId: lead.id,
        itemType: "FORM_SUBMISSION",
        title: `Form submission: ${form.name}`,
        sourceSystem: "LEAD_CAPTURE_FORM",
        sourceId: submission.id,
        metadata: { formId: form.id, formVersionId: version.id, company } as Prisma.InputJsonValue,
      },
    });

    const thankYou = form.thankYouActions[0];
    return {
      submissionId: submission.id,
      status: "ACCEPTED",
      crmLeadId: lead.id,
      thankYou: thankYou
        ? {
            actionType: thankYou.actionType,
            redirectUrl: thankYou.isRedirectValidated ? thankYou.redirectUrl : null,
            config: thankYou.config,
          }
        : { actionType: "INLINE_CONFIRMATION" },
      receiptAt: submission.receiptAt,
    };
  },

  buildReceiptHash(submissionId: string, receiptAt: Date): string {
    return createHash("sha256").update(`${submissionId}:${receiptAt.toISOString()}`).digest("hex").slice(0, 16);
  },
};
