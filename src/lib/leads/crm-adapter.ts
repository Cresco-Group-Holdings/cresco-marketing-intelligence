import type { CrmProvider } from "@prisma/client";

export type CrmLeadPayload = {
  leadId: string;
  displayName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobRole?: string;
  country?: string;
  expressedInterest?: string;
  status: string;
  source: string;
  provider?: string;
  campaign?: string;
  metadata?: Record<string, unknown>;
};

export type CrmHandoffResult = {
  externalId?: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  response?: Record<string, unknown>;
  errorMessage?: string;
};

export interface CrmAdapter {
  readonly provider: CrmProvider;
  handoff(input: {
    payload: CrmLeadPayload;
    idempotencyKey: string;
    webhookUrl?: string;
  }): Promise<CrmHandoffResult>;
}

class FakeCrmAdapter implements CrmAdapter {
  readonly provider = "FAKE" as const;

  async handoff(input: {
    payload: CrmLeadPayload;
    idempotencyKey: string;
  }): Promise<CrmHandoffResult> {
    return {
      externalId: `fake-${input.payload.leadId}`,
      status: "SENT",
      response: { idempotencyKey: input.idempotencyKey, provider: "FAKE" },
    };
  }
}

class WebhookCrmAdapter implements CrmAdapter {
  readonly provider = "WEBHOOK" as const;

  async handoff(input: {
    payload: CrmLeadPayload;
    idempotencyKey: string;
    webhookUrl?: string;
  }): Promise<CrmHandoffResult> {
    if (!input.webhookUrl) {
      return {
        status: "SKIPPED",
        errorMessage: "Webhook URL is not configured.",
      };
    }

    try {
      const response = await fetch(input.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": input.idempotencyKey,
        },
        body: JSON.stringify(input.payload),
      });

      if (!response.ok) {
        return {
          status: "FAILED",
          errorMessage: `Webhook returned ${response.status}.`,
        };
      }

      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        status: "SENT",
        externalId: typeof body.externalId === "string" ? body.externalId : undefined,
        response: body,
      };
    } catch (error) {
      return {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Webhook handoff failed.",
      };
    }
  }
}

class CsvCrmAdapter implements CrmAdapter {
  readonly provider = "CSV" as const;

  async handoff(input: {
    payload: CrmLeadPayload;
    idempotencyKey: string;
  }): Promise<CrmHandoffResult> {
    return {
      status: "SKIPPED",
      response: {
        message: "CSV export is handled separately.",
        idempotencyKey: input.idempotencyKey,
        leadId: input.payload.leadId,
      },
    };
  }
}

class UnsupportedCrmAdapter implements CrmAdapter {
  constructor(readonly provider: CrmProvider) {}

  async handoff(): Promise<CrmHandoffResult> {
    return {
      status: "SKIPPED",
      errorMessage: `${this.provider} integration is not yet implemented.`,
    };
  }
}

const ADAPTERS: Record<CrmProvider, CrmAdapter> = {
  FAKE: new FakeCrmAdapter(),
  WEBHOOK: new WebhookCrmAdapter(),
  CSV: new CsvCrmAdapter(),
  HUBSPOT: new UnsupportedCrmAdapter("HUBSPOT"),
  SALESFORCE: new UnsupportedCrmAdapter("SALESFORCE"),
  PIPEDRIVE: new UnsupportedCrmAdapter("PIPEDRIVE"),
  CRESCO_INTERNAL: new UnsupportedCrmAdapter("CRESCO_INTERNAL"),
};

export function getCrmAdapter(provider: CrmProvider): CrmAdapter {
  return ADAPTERS[provider];
}

export function registerCrmAdapter(adapter: CrmAdapter): void {
  ADAPTERS[adapter.provider] = adapter;
}
