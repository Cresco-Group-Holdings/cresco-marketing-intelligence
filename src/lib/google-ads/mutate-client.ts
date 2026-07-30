import { getServerEnv } from "@/lib/environment";
import { normalisePaidAdsHttpError, PaidAdsApiError } from "@/lib/paid-ads/errors";
import { GOOGLE_ADS_API_BASE, type GoogleAdsHttpClient, defaultGoogleAdsHttpClient } from "./client";

export type MutateRequest = {
  operations: Array<{ create?: Record<string, unknown>; update?: Record<string, unknown>; remove?: string }>;
  validateOnly?: boolean;
  partialFailure?: boolean;
};

export type MutateResponse = {
  results?: Array<{ resourceName?: string }>;
  partialFailureError?: unknown;
};

export type CustomerDetails = {
  id: string;
  currencyCode?: string;
  timeZone?: string;
  descriptiveName?: string;
  testAccount?: boolean;
  manager?: boolean;
};

function developerHeaders(loginCustomerId?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getServerEnv().GOOGLE_ADS_DEVELOPER_TOKEN;
  if (token) headers["developer-token"] = token;
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  return headers;
}

export class GoogleAdsMutateClient {
  constructor(private readonly http: GoogleAdsHttpClient = defaultGoogleAdsHttpClient) {}

  async getCustomerDetails(
    accessToken: string,
    customerId: string,
    loginCustomerId?: string,
  ): Promise<CustomerDetails> {
    const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.test_account, customer.manager FROM customer LIMIT 1`;
    const data = await this.http.post<{ results?: Array<{ customer?: Record<string, unknown> }> }>(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId.replace(/-/g, "")}/googleAds:search`,
      accessToken,
      { query },
      developerHeaders(loginCustomerId),
    );
    const customer = data.results?.[0]?.customer ?? {};
    return {
      id: String(customer.id ?? customerId),
      currencyCode: customer.currencyCode as string | undefined,
      timeZone: customer.timeZone as string | undefined,
      descriptiveName: customer.descriptiveName as string | undefined,
      testAccount: Boolean(customer.testAccount),
      manager: Boolean(customer.manager),
    };
  }

  async mutateResource(
    accessToken: string,
    customerId: string,
    resource: string,
    body: MutateRequest,
    loginCustomerId?: string,
  ): Promise<MutateResponse> {
    const cleanId = customerId.replace(/-/g, "");
    try {
      return await this.http.post<MutateResponse>(
        `${GOOGLE_ADS_API_BASE}/customers/${cleanId}/${resource}:mutate`,
        accessToken,
        {
          operations: body.operations,
          validateOnly: body.validateOnly ?? false,
          partialFailure: body.partialFailure ?? false,
        },
        developerHeaders(loginCustomerId),
      );
    } catch (err) {
      if (err instanceof PaidAdsApiError) throw err;
      throw new PaidAdsApiError(normalisePaidAdsHttpError("GOOGLE_ADS", 500, err));
    }
  }

  async validateCampaignBudget(
    accessToken: string,
    customerId: string,
    operations: MutateRequest["operations"],
    loginCustomerId?: string,
  ): Promise<MutateResponse> {
    return this.mutateResource(accessToken, customerId, "campaignBudgets", { operations, validateOnly: true }, loginCustomerId);
  }

  async createCampaignBudget(
    accessToken: string,
    customerId: string,
    operations: MutateRequest["operations"],
    loginCustomerId?: string,
    validateOnly = false,
  ): Promise<MutateResponse> {
    return this.mutateResource(
      accessToken,
      customerId,
      "campaignBudgets",
      { operations, validateOnly, partialFailure: false },
      loginCustomerId,
    );
  }

  async createCampaigns(
    accessToken: string,
    customerId: string,
    operations: MutateRequest["operations"],
    loginCustomerId?: string,
    validateOnly = false,
  ): Promise<MutateResponse> {
    return this.mutateResource(
      accessToken,
      customerId,
      "campaigns",
      { operations, validateOnly, partialFailure: true },
      loginCustomerId,
    );
  }

  async createAdGroups(
    accessToken: string,
    customerId: string,
    operations: MutateRequest["operations"],
    loginCustomerId?: string,
    validateOnly = false,
  ): Promise<MutateResponse> {
    return this.mutateResource(
      accessToken,
      customerId,
      "adGroups",
      { operations, validateOnly, partialFailure: true },
      loginCustomerId,
    );
  }

  async createAdGroupAds(
    accessToken: string,
    customerId: string,
    operations: MutateRequest["operations"],
    loginCustomerId?: string,
    validateOnly = false,
  ): Promise<MutateResponse> {
    return this.mutateResource(
      accessToken,
      customerId,
      "adGroupAds",
      { operations, validateOnly, partialFailure: true },
      loginCustomerId,
    );
  }

  async createAdGroupCriteria(
    accessToken: string,
    customerId: string,
    operations: MutateRequest["operations"],
    loginCustomerId?: string,
    validateOnly = false,
  ): Promise<MutateResponse> {
    return this.mutateResource(
      accessToken,
      customerId,
      "adGroupCriteria",
      { operations, validateOnly, partialFailure: true },
      loginCustomerId,
    );
  }

  async updateCampaignStatus(
    accessToken: string,
    customerId: string,
    resourceName: string,
    status: "PAUSED" | "ENABLED",
    loginCustomerId?: string,
  ): Promise<MutateResponse> {
    return this.mutateResource(
      accessToken,
      customerId,
      "campaigns",
      {
        operations: [{ update: { resourceName, status }, updateMask: "status" } as never],
        partialFailure: false,
      },
      loginCustomerId,
    );
  }
}

export const googleAdsMutateClient = new GoogleAdsMutateClient();
