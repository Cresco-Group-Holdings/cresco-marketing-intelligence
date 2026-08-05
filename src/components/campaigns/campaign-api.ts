import type { ApiEnvelope } from "@/lib/api/client";
import type {
  CampaignDetail,
  CampaignDraftInput,
  CampaignListResponse,
  CampaignResponse,
} from "@/components/campaigns/types";

export class CampaignApiError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly isVersionConflict: boolean;

  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.name = "CampaignApiError";
    this.code = code;
    this.requestId = requestId;
    this.isVersionConflict = code === "VERSION_CONFLICT";
  }
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const contentType = response.headers.get("content-type");
  if (!isJsonContentType(contentType)) {
    throw new CampaignApiError("INTERNAL_ERROR", "The service is temporarily unavailable.");
  }

  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new CampaignApiError("INTERNAL_ERROR", "The service is temporarily unavailable.");
  }
}

type CampaignRequestOptions = RequestInit & {
  organisationId?: string | null;
  brandId?: string | null;
};

async function campaignRequest<T>(path: string, options?: CampaignRequestOptions): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (options?.organisationId) {
    headers.set("x-organisation-id", options.organisationId);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const body = await parseEnvelope<T>(response);
  if (!body.success || body.data == null) {
    throw new CampaignApiError(
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "Request failed.",
      body.error?.requestId,
    );
  }

  return body.data;
}

export function formatCampaignError(error: unknown): string {
  if (error instanceof CampaignApiError) {
    if (error.isVersionConflict) {
      return "This campaign was updated elsewhere. Reload the page to get the latest version, then try again.";
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

export function isCampaignVersionConflict(error: unknown): boolean {
  return error instanceof CampaignApiError && error.isVersionConflict;
}

export async function listCampaigns(
  organisationId: string,
  filters?: { brandId?: string | null; status?: string; search?: string },
): Promise<CampaignListResponse> {
  const params = new URLSearchParams({ organisationId });
  if (filters?.brandId) params.set("brandId", filters.brandId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);

  return campaignRequest<CampaignListResponse>(`/api/campaigns?${params.toString()}`, {
    organisationId,
  });
}

export async function getCampaign(
  campaignId: string,
  organisationId: string,
): Promise<CampaignDetail> {
  const params = new URLSearchParams({ organisationId });
  const data = await campaignRequest<CampaignResponse>(
    `/api/campaigns/${campaignId}?${params.toString()}`,
    { organisationId },
  );
  return data.campaign;
}

export async function createCampaign(
  organisationId: string,
  input: CampaignDraftInput,
): Promise<CampaignDetail> {
  const params = new URLSearchParams({ organisationId });
  const data = await campaignRequest<CampaignResponse>(`/api/campaigns?${params.toString()}`, {
    method: "POST",
    organisationId,
    body: JSON.stringify(input),
  });
  return data.campaign;
}

export async function updateCampaign(
  campaignId: string,
  organisationId: string,
  input: CampaignDraftInput,
): Promise<CampaignDetail> {
  const params = new URLSearchParams({ organisationId });
  const data = await campaignRequest<CampaignResponse>(
    `/api/campaigns/${campaignId}?${params.toString()}`,
    {
      method: "PATCH",
      organisationId,
      body: JSON.stringify(input),
    },
  );
  return data.campaign;
}
