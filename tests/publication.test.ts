import { describe, expect, it } from "vitest";
import { publicationIssues } from "../src/lib/publication";
import { errorMessage, validationDetail } from "../src/lib/validation";
import type { CatalogRecord } from "../src/lib/catalog";

const product: CatalogRecord = {
  id: "p",
  name: "Impresora",
  slug: "impresora",
  version: 1,
  status: "DRAFT",
  shortDescription: "Impresora UV",
  categories: [{ categoryId: "c" }],
  images: [{ id: "i", role: "MAIN", altText: "Vista frontal", sortOrder: 0 }],
};
const category = { ...product, id: "c", isVisible: true };
describe("publication guidance", () => {
  it("lists all missing requirements with their correction sections", () => {
    const issues = publicationIssues(
      { ...product, shortDescription: " ", categories: [], images: [] },
      [],
    );
    expect(issues.map((issue) => issue.tab)).toEqual([
      "information",
      "categories",
      "images",
    ]);
    expect(issues[1].message).toContain("No hay categorías asignadas");
  });
  it("explains invisible assigned categories and missing alternative text separately", () => {
    const issues = publicationIssues(
      { ...product, images: [{ ...product.images![0], altText: " " }] },
      [{ ...category, isVisible: false }],
    );
    expect(issues[0].message).toContain("categorías superiores");
    expect(issues[1].message).toContain("no tiene texto alternativo");
    expect(publicationIssues(product, [category])).toEqual([]);
  });
  it("preserves unknown server reasons and clarifies known publication failures", () => {
    expect(
      errorMessage("VALIDATION_ERROR", "Elegí al menos una categoría visible."),
    ).toContain("categorías superiores deben estar publicadas");
    expect(errorMessage("NEW_RULE", "Motivo específico del servidor")).toBe(
      "Motivo específico del servidor",
    );
  });
  it("distinguishes character limits from numeric bounds and preserves unknown field names", () => {
    expect(
      validationDetail({
        field: "shortDescription",
        message: "Too big: expected string to have <=500 characters",
      }),
    ).toContain("500 caracteres");
    expect(
      validationDetail({
        field: "quantity",
        message: "Too small: expected number to be >=0",
      }),
    ).toContain("mayor o igual a 0");
    expect(
      validationDetail({ field: "customField", message: "Required" }),
    ).toBe("customField: Este campo es obligatorio.");
  });
});
