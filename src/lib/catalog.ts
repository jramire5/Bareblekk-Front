export const resources = {
  products: {
    label: "Products",
    singular: "product",
    description: "Manage the printers in your catalog.",
    icon: "▤",
  },
  categories: {
    label: "Categories",
    singular: "category",
    description: "Organize printers into a clear category hierarchy.",
    icon: "◫",
  },
  brands: {
    label: "Brands",
    singular: "brand",
    description: "Manage the manufacturers behind your products.",
    icon: "◈",
  },
  "product-lines": {
    label: "Product lines",
    singular: "product line",
    description: "Group related models within each brand.",
    icon: "≡",
  },
  applications: {
    label: "Applications",
    singular: "application",
    description: "Define what your printers can be used for.",
    icon: "◇",
  },
  tags: {
    label: "Tags",
    singular: "tag",
    description: "Add useful labels to organize your catalog.",
    icon: "#",
  },
  attributes: {
    label: "Technical attributes",
    singular: "attribute",
    description: "Define the specifications used to compare printers.",
    icon: "⊞",
  },
  downloads: {
    label: "Documents",
    singular: "document",
    description: "Manage brochures, datasheets, and product manuals.",
    icon: "▧",
  },
} as const;
export type Resource = keyof typeof resources;
export type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
};
export type Spec = {
  attributeId: string;
  textValue: string | null;
  numberValue: string | number | null;
  booleanValue: boolean | null;
  groupName: string | null;
  sortOrder: number;
};
export type ProductImage = {
  id: string;
  altText: string;
  role: "MAIN" | "GALLERY";
  sortOrder: number;
};
export type ProductVideo = {
  id: string;
  title: string;
  url: string;
  provider: "YOUTUBE" | "VIMEO";
  sortOrder: number;
};
export type CatalogRecord = {
  id: string;
  name: string;
  version: number;
  slug: string;
  status: Status;
  publishedAt?: string | null;
  description?: string | null;
  sortOrder?: number;
  brandId?: string;
  productLineId?: string | null;
  parentId?: string | null;
  sku?: string | null;
  shortDescription?: string | null;
  lifecycle?: "ACTIVE" | "DISCONTINUED";
  isFeatured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  stockQuantity?: number | null;
  isVisible?: boolean;
  categories?: { categoryId: string }[];
  applications?: { applicationId: string }[];
  tags?: { tagId: string }[];
  specifications?: Spec[];
  images?: ProductImage[];
  videos?: ProductVideo[];
  code?: string;
  type?: string;
  unit?: string | null;
  allowedValues?: string[];
  filterable?: boolean;
  active?: boolean;
  title?: string;
  productId?: string | null;
};
export type Lookups = Partial<Record<Resource, CatalogRecord[]>>;
export type Page = {
  data: CatalogRecord[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};
export const statusLabels: Record<Status, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180)
    .replace(/-$/, "");
}
export function allowedStatuses(status: Status): Status[] {
  return status === "ARCHIVED"
    ? ["DRAFT"]
    : status === "PUBLISHED"
      ? ["DRAFT", "ARCHIVED"]
      : ["PUBLISHED", "ARCHIVED"];
}
export function categoryParents(rows: CatalogRecord[], id?: string) {
  const excluded = new Set(id ? [id] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows)
      if (row.parentId && excluded.has(row.parentId) && !excluded.has(row.id)) {
        excluded.add(row.id);
        changed = true;
      }
  }
  return rows.filter((row) => !excluded.has(row.id));
}
export function specPayload(items: Spec[], attributes: CatalogRecord[]) {
  return items.map((item) => {
    const attribute = attributes.find((a) => a.id === item.attributeId);
    if (!attribute)
      throw new Error("Choose an attribute for every specification.");
    let value: string | number | boolean;
    if (attribute.type === "NUMBER") {
      if (item.numberValue === null || String(item.numberValue).trim() === "")
        throw new Error("Enter a number for " + attribute.name + ".");
      value = Number(item.numberValue);
      if (
        !Number.isFinite(value) ||
        Math.abs(value) > 9999999999.9999 ||
        Math.abs(value * 10000 - Math.round(value * 10000)) > 0.001
      )
        throw new Error("Use a valid number with at most four decimal places.");
    } else if (attribute.type === "BOOLEAN") value = item.booleanValue ?? false;
    else {
      value = item.textValue?.trim() ?? "";
      if (!value) throw new Error("Enter a value for " + attribute.name + ".");
      if (
        attribute.type === "ENUM" &&
        !attribute.allowedValues?.includes(value)
      )
        throw new Error("Choose a valid option for " + attribute.name + ".");
    }
    return {
      attributeId: item.attributeId,
      value,
      groupName: item.groupName || null,
      sortOrder: item.sortOrder,
    };
  });
}
