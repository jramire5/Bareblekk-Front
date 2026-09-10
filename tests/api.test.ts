import { afterEach, describe, expect, it, vi } from "vitest";
import { allRecords, request } from "../src/lib/api";

afterEach(() => vi.unstubAllGlobals());
describe("Bareblekk API client", () => {
  it("sends session cookies and quoted If-Match versions with updates", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { version: 4 } })),
      );
    vi.stubGlobal("fetch", fetch);
    await request("/admin/products/id", {
      method: "PATCH",
      version: 3,
      body: { name: "Printer" },
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/v1/admin/products/id");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("If-Match")).toBe('"3"');
    expect(JSON.parse(options.body)).toEqual({ name: "Printer" });
  });
  it("leaves multipart content-type to the browser and supports empty delete responses", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const body = new FormData();
    body.set("altText", "Printer front");
    await expect(
      request("/admin/products/id/images", {
        method: "POST",
        body,
        version: 2,
      }),
    ).resolves.toBeUndefined();
    expect(fetch.mock.calls[0][1].headers.has("Content-Type")).toBe(false);
    expect(fetch.mock.calls[0][1].body).toBe(body);
  });
  it("surfaces concurrent-edit conflicts without retrying the mutation", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "STALE_VERSION" } }), {
          status: 412,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      request("/admin/products/id", {
        method: "PATCH",
        version: 1,
        body: { name: "Printer" },
      }),
    ).rejects.toMatchObject({ status: 412, code: "STALE_VERSION" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("includes backend field validation details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: {
                message: "Review fields",
                details: [{ field: "slug", message: "Invalid slug" }],
              },
            }),
            { status: 422 },
          ),
        ),
    );
    await expect(request("/admin/categories")).rejects.toThrow(
      "Identificador de URL: Usá solo letras minúsculas, números y guiones entre palabras, sin espacios ni acentos.",
    );
  });
  it("handles unavailable backends and invalid responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Network error")),
    );
    await expect(request("/auth/me")).rejects.toMatchObject({
      code: "CONNECTION_ERROR",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Wrong service</html>")),
    );
    await expect(request("/auth/me")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("loads all pages for relationship selectors rather than silently truncating them", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ id: "first" }], meta: { totalPages: 2 } }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ id: "second" }], meta: { totalPages: 2 } }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await allRecords("categories")).toEqual([
      { id: "first" },
      { id: "second" },
    ]);
    expect(fetch.mock.calls[1][0]).toContain("page=2");
  });
});
