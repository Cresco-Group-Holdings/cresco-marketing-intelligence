export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown>;
  error: { code: string; message: string; requestId: string } | null;
};

const SERVICE_UNAVAILABLE_MESSAGE = "The service is temporarily unavailable.";

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

async function parseApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const contentType = response.headers.get("content-type");

  if (!isJsonContentType(contentType)) {
    console.error("API response was not JSON.", {
      status: response.status,
      contentType,
      path: response.url,
    });
    throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  }

  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    console.error("API response JSON parsing failed.", {
      status: response.status,
      contentType,
      path: response.url,
    });
    throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & {
    organisationId?: string | null;
    projectId?: string | null;
  },
): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (options?.organisationId) {
    headers.set("x-organisation-id", options.organisationId);
  }
  if (options?.projectId) {
    headers.set("x-project-id", options.projectId);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const body = await parseApiResponse<T>(response);
  if (!body.success || !body.data) {
    throw new Error(body.error?.message ?? "Request failed.");
  }

  return body.data;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options?: {
    organisationId?: string | null;
    projectId?: string | null;
  },
): Promise<T> {
  const headers = new Headers();
  if (options?.organisationId) {
    headers.set("x-organisation-id", options.organisationId);
  }
  if (options?.projectId) {
    headers.set("x-project-id", options.projectId);
  }

  const response = await fetch(path, {
    method: "POST",
    body: formData,
    headers,
  });

  const body = await parseApiResponse<T>(response);
  if (!body.success || !body.data) {
    throw new Error(body.error?.message ?? "Upload failed.");
  }

  return body.data;
}
