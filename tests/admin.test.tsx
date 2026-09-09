// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Admin from "../src/components/Admin";
import EntityEditor from "../src/components/EntityEditor";
import { ApiError, allRecords, request } from "../src/lib/api";
import type { CatalogRecord } from "../src/lib/catalog";

vi.mock("../src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/api")>()),
  request: vi.fn(),
  allRecords: vi.fn(),
}));
const admin = {
  id: "user",
  name: "Catalog administrator",
  email: "admin@example.test",
  role: "ADMIN",
};
const base: CatalogRecord = {
  id: "category-1",
  name: "UV printers",
  slug: "uv-printers",
  status: "DRAFT",
  version: 1,
  parentId: null,
  sortOrder: 0,
};
beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(allRecords).mockReset().mockResolvedValue([]);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  vi.spyOn(window, "confirm").mockReturnValue(true);
  location.hash = "";
});
afterEach(cleanup);
describe("administrator workflows", () => {
  it("signs in, displays records, and signs out using the session endpoints", async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === "/auth/me")
        throw new ApiError(401, "UNAUTHENTICATED", "Sign in");
      if (path === "/auth/login") return { data: admin } as never;
      if (path === "/auth/logout") return undefined as never;
      return {
        data: [{ ...base, sku: "UV-1" }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      } as never;
    });
    const user = userEvent.setup();
    render(<Admin />);
    await user.type(
      await screen.findByLabelText("Email"),
      "admin@example.test",
    );
    await user.type(screen.getByLabelText("Password"), "example-password");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));
    expect(await screen.findByText("UV-1")).toBeTruthy();
    expect(request).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: { email: "admin@example.test", password: "example-password" },
    });
    await user.click(screen.getAllByRole("button", { name: "Sign out" })[0]);
    expect(await screen.findByLabelText("Password")).toBeTruthy();
  });
  it("creates, edits, archives, and restores a category with current versions", async () => {
    let record = { ...base };
    vi.mocked(request).mockImplementation(async (_path, options) => {
      if (options?.method === "POST") {
        record = { ...base, ...(options.body as object) };
        return { data: record } as never;
      }
      if (options?.method === "PATCH" || options?.method === "PUT") {
        record = {
          ...record,
          ...(options.body as object),
          version: record.version + 1,
        };
        return { data: record } as never;
      }
      return { data: record } as never;
    });
    const user = userEvent.setup();
    render(
      <EntityEditor
        resource="categories"
        canEdit
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.type(await screen.findByLabelText("Name *"), "UV printers");
    expect((screen.getByLabelText(/^Slug \*/) as HTMLInputElement).value).toBe(
      "uv-printers",
    );
    await user.click(screen.getByRole("button", { name: "Create record" }));
    await screen.findByRole("button", { name: "Save changes" });
    await user.clear(screen.getByLabelText("Name *"));
    await user.type(screen.getByLabelText("Name *"), "Industrial UV printers");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(record.name).toBe("Industrial UV printers"));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Archive" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(
      await screen.findByRole("button", { name: "Restore draft" }),
    );
    await waitFor(() => expect(record.status).toBe("DRAFT"));
    const mutations = vi
      .mocked(request)
      .mock.calls.filter(([, o]) => o?.method === "PUT");
    expect(mutations.map(([, o]) => o?.version)).toEqual([2, 3]);
    expect(mutations.map(([, o]) => o?.body)).toEqual([
      { status: "ARCHIVED" },
      { status: "DRAFT" },
    ]);
  });
  it("keeps unsaved input when a concurrent edit is rejected", async () => {
    vi.mocked(request).mockImplementation(async (_, options) => {
      if (options?.method === "PATCH")
        throw new ApiError(
          412,
          "STALE_VERSION",
          "Someone else updated this record.",
        );
      return { data: base } as never;
    });
    const user = userEvent.setup();
    render(
      <EntityEditor
        resource="categories"
        id={base.id}
        canEdit
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.clear(await screen.findByLabelText("Name *"));
    await user.type(screen.getByLabelText("Name *"), "Unsaved category");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Name *") as HTMLInputElement).value).toBe(
      "Unsaved category",
    );
  });
  it("disables mutations for viewers", async () => {
    vi.mocked(request).mockResolvedValue({ data: base });
    render(
      <EntityEditor
        resource="categories"
        id={base.id}
        canEdit={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const name = await screen.findByLabelText("Name *");
    expect(name.closest("fieldset")?.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });
  it("creates a printer with its selected brand and edits category assignments", async () => {
    let record: CatalogRecord = {
      ...base,
      id: "product-1",
      brandId: "brand-1",
      categories: [],
      images: [],
    };
    vi.mocked(allRecords).mockImplementation(async (resource) =>
      resource === "brands"
        ? [{ ...base, id: "brand-1", name: "Mimaki" }]
        : resource === "categories"
          ? [{ ...base, isVisible: true }]
          : [],
    );
    vi.mocked(request).mockImplementation(async (_path, options) => {
      if (options?.method === "POST")
        record = { ...record, ...(options.body as object) };
      if (options?.method === "PUT")
        record = {
          ...record,
          version: 2,
          categories: [{ categoryId: base.id }],
        };
      return { data: record } as never;
    });
    const user = userEvent.setup();
    render(
      <EntityEditor
        resource="products"
        canEdit
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.type(await screen.findByLabelText("Name *"), "Mimaki UJF");
    await user.selectOptions(screen.getByLabelText("Brand *"), "brand-1");
    await user.click(screen.getByRole("button", { name: "Create product" }));
    await user.click(await screen.findByRole("button", { name: "Categories" }));
    await user.click(
      await screen.findByRole("checkbox", { name: /UV printers/ }),
    );
    await user.click(screen.getByRole("button", { name: "Save categories" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "/admin/products/product-1/categories",
        expect.objectContaining({
          method: "PUT",
          version: 1,
          body: { ids: ["category-1"] },
        }),
      ),
    );
  });
});
