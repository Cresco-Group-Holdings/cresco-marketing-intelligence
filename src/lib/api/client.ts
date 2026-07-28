export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown>;
  error: { code: string; message: string; requestId: string } | null;
};

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

  const body = (await response.json()) as ApiEnvelope<T>;
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

  const body = (await response.json()) as ApiEnvelope<T>;
  if (!body.success || !body.data) {
    throw new Error(body.error?.message ?? "Upload failed.");
  }

  return body.data;
}
