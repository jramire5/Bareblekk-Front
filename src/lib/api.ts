import type { CatalogRecord, Page, Resource } from "./catalog";
import { errorMessage, validationDetail } from "./validation";

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
      "No se pudo conectar con Bareblekk. Verificá que el servidor esté funcionando e intentá de nuevo. Si estabas guardando, recargá el registro para comprobar si el cambio se aplicó antes de reintentar.",
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
        ? "Otra persona actualizó este registro. Tus cambios no se guardaron. Recargá la última versión antes de volver a editar."
        : errorMessage(json?.error?.code ?? "REQUEST_FAILED", json?.error?.message ??
          "No se pudo completar la solicitud. Verificá la conexión con el servidor e intentá de nuevo.");
    throw new ApiError(
      response.status,
      json?.error?.code ?? "REQUEST_FAILED",
      message +
        (Array.isArray(details)
          ? " " +
            details.map(validationDetail).join(" · ")
          : ""),
    );
  }
  if (!json || !("data" in json))
    throw new ApiError(
      0,
      "INVALID_RESPONSE",
      "El servidor devolvió una respuesta inesperada. Verificá la dirección de la API.",
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
