import type { CatalogRecord, Page, Resource } from "./catalog";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const apiBase = (
  import.meta.env.PUBLIC_API_BASE_URL || "/api/v1"
).replace(/\/$/, "");
export async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    version?: number;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  const multipart = options.body instanceof FormData;
  if (options.body !== undefined && !multipart)
    headers.set("Content-Type", "application/json");
  if (options.version !== undefined)
    headers.set("If-Match", `"${options.version}"`);
  let response: Response;
  try {
    response = await fetch(apiBase + path, {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: options.signal ?? AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      "CONNECTION_ERROR",
      "Cannot reach Bareblekk. Check that the backend is running, then try again. If you were saving, reload the record before retrying to check whether the change was applied.",
    );
  }
  if (response.status === 204) return undefined as T;
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !path.startsWith("/auth/")
    )
      window.dispatchEvent(new Event("bareblekk:unauthenticated"));
    const details = json?.error?.details;
    const message =
      response.status === 412
        ? "Someone else updated this record. Your changes have not been saved. Reload the latest version before editing again."
        : (json?.error?.message ??
          "The request could not be completed. Check the backend connection and try again.");
    throw new ApiError(
      response.status,
      json?.error?.code ?? "REQUEST_FAILED",
      message +
        (Array.isArray(details)
          ? " " +
            details
              .map(
                (d: { field: string; message: string }) =>
                  `${d.field}: ${d.message}`,
              )
              .join(" · ")
          : ""),
    );
  }
  if (!json || !("data" in json))
    throw new ApiError(
      0,
      "INVALID_RESPONSE",
      "The API returned an unexpected response. Check the API address.",
    );
  return json as T;
}
export const recordPath = (resource: Resource, id?: string) =>
  "/admin/" + resource + (id ? "/" + encodeURIComponent(id) : "");
export async function allRecords(
  resource: Resource,
  signal?: AbortSignal,
): Promise<CatalogRecord[]> {
  const rows: CatalogRecord[] = [];
  let page = 1;
  while (true) {
    const result = await request<Page>(
      recordPath(resource) + `?page=${page}&pageSize=100`,
      { signal },
    );
    rows.push(...result.data);
    if (page >= result.meta.totalPages) return rows;
    page++;
  }
}
