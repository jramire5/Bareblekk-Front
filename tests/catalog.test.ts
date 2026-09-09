import { describe, expect, it } from "vitest";
import {
  allowedStatuses,
  categoryParents,
  slugify,
  specPayload,
  type CatalogRecord,
  type Spec,
} from "../src/lib/catalog";

const category = (id: string, parentId: string | null): CatalogRecord => ({
  id,
  parentId,
  name: id,
  slug: id,
  version: 1,
  status: "DRAFT",
});
const attr = (type: string): CatalogRecord => ({
  id: "a",
  name: "Width",
  slug: "",
  version: 1,
  status: "DRAFT",
  type,
  allowedValues: ["Wide", "Narrow"],
});
const spec: Spec = {
  attributeId: "a",
  textValue: null,
  numberValue: null,
  booleanValue: null,
  groupName: null,
  sortOrder: 0,
};
describe("catalog rules", () => {
  it("generates valid slugs from printer model names and accented category names", () => {
    expect(slugify("  Mimaki UJF-6042 MkII e  ")).toBe(
      "mimaki-ujf-6042-mkii-e",
    );
    expect(slugify("Impresión / sublimación")).toBe("impresion-sublimacion");
    expect(slugify("a".repeat(179) + " - more")).toHaveLength(179);
  });
  it("requires restoration before publishing archived records", () => {
    expect(allowedStatuses("ARCHIVED")).toEqual(["DRAFT"]);
    expect(allowedStatuses("PUBLISHED")).toEqual(["DRAFT", "ARCHIVED"]);
  });
  it("excludes the selected category and all descendants from parent choices", () => {
    const rows = [
      category("root", null),
      category("child", "root"),
      category("grandchild", "child"),
      category("other", null),
    ];
    expect(categoryParents(rows, "root").map((c) => c.id)).toEqual(["other"]);
    expect(categoryParents(rows, "child").map((c) => c.id)).toEqual([
      "root",
      "other",
    ]);
  });
  it("preserves zero and false values in specification requests", () => {
    expect(
      specPayload([{ ...spec, numberValue: "0" }], [attr("NUMBER")])[0].value,
    ).toBe(0);
    expect(
      specPayload([{ ...spec, booleanValue: false }], [attr("BOOLEAN")])[0]
        .value,
    ).toBe(false);
  });
  it("rejects missing and out-of-range numeric values and invalid enum choices", () => {
    expect(() => specPayload([spec], [attr("NUMBER")])).toThrow(
      "Enter a number",
    );
    expect(() =>
      specPayload([{ ...spec, numberValue: "2.00001" }], [attr("NUMBER")]),
    ).toThrow("four decimal");
    expect(() =>
      specPayload([{ ...spec, textValue: "Unknown" }], [attr("ENUM")]),
    ).toThrow("valid option");
    expect(
      specPayload([{ ...spec, textValue: "Wide" }], [attr("ENUM")])[0].value,
    ).toBe("Wide");
  });
});
