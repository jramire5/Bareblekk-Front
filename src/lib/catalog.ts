export const resources = {
  products: {
    label: "Productos",
    singular: "producto",
    description: "Administrá las impresoras de tu catálogo.",
    icon: "▤",
  },
  categories: {
    label: "Categorías",
    singular: "categoría",
    description: "Organizá las impresoras en una jerarquía clara de categorías.",
    icon: "◫",
  },
  brands: {
    label: "Marcas",
    singular: "marca",
    description: "Administrá los fabricantes de tus productos.",
    icon: "◈",
  },
  "product-lines": {
    label: "Líneas de productos",
    singular: "línea de productos",
    description: "Agrupá los modelos relacionados de cada marca.",
    icon: "≡",
  },
  applications: {
    label: "Aplicaciones",
    singular: "aplicación",
    description: "Definí los usos de tus impresoras.",
    icon: "◇",
  },
  tags: {
    label: "Etiquetas",
    singular: "etiqueta",
    description: "Agregá etiquetas útiles para organizar tu catálogo.",
    icon: "#",
  },
  attributes: {
    label: "Atributos técnicos",
    singular: "atributo",
    description: "Definí las especificaciones para comparar impresoras.",
    icon: "⊞",
  },
  downloads: {
    label: "Documentos",
    singular: "documento",
    description: "Administrá folletos, fichas técnicas y manuales de productos.",
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
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
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
      throw new Error("Elegí un atributo para cada especificación.");
    let value: string | number | boolean;
    if (attribute.type === "NUMBER") {
      if (item.numberValue === null || String(item.numberValue).trim() === "")
        throw new Error("Ingresá un número para " + attribute.name + ".");
      value = Number(item.numberValue);
      if (
        !Number.isFinite(value) ||
        Math.abs(value) > 9999999999.9999 ||
        Math.abs(value * 10000 - Math.round(value * 10000)) > 0.001
      )
        throw new Error("Usá un número válido con hasta cuatro decimales.");
    } else if (attribute.type === "BOOLEAN") value = item.booleanValue ?? false;
    else {
      value = item.textValue?.trim() ?? "";
      if (!value) throw new Error("Ingresá un valor para " + attribute.name + ".");
      if (
        attribute.type === "ENUM" &&
        !attribute.allowedValues?.includes(value)
      )
        throw new Error("Elegí una opción válida para " + attribute.name + ".");
    }
    return {
      attributeId: item.attributeId,
      value,
      groupName: item.groupName || null,
      sortOrder: item.sortOrder,
    };
  });
}

export const tabLabels: Record<string, string> = {
  information: "Información", categories: "Categorías", applications: "Aplicaciones",
  tags: "Etiquetas", stock: "Existencias", specifications: "Especificaciones",
  images: "Imágenes", videos: "Videos",
};
export const roleLabels: Record<User["role"], string> = {
  ADMIN: "Administrador", EDITOR: "Editor", VIEWER: "Solo lectura",
};
export const typeLabels: Record<string, string> = {
  TEXT: "Texto", NUMBER: "Número", BOOLEAN: "Sí / no", ENUM: "Opción de una lista",
  BROCHURE: "Folleto", DATASHEET: "Ficha técnica", MANUAL: "Manual", OTHER: "Otro",
};
