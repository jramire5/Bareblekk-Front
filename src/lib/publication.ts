import type { CatalogRecord } from "./catalog";

export function publicationIssues(row: CatalogRecord, categories: CatalogRecord[]) {
  const issues: { tab: string; message: string }[] = [];
  if (!row.name?.trim() || !row.slug?.trim())
    issues.push({ tab: "information", message: "Falta el nombre o el identificador de URL. Completalos en Información y guardá los cambios." });
  if (!row.shortDescription?.trim())
    issues.push({ tab: "information", message: "Falta la descripción breve. Completala en Información y guardá los cambios." });
  const assigned = row.categories ?? [];
  if (!assigned.some(link => categories.some(category => category.id === link.categoryId && category.isVisible)))
    issues.push({ tab: "categories", message: assigned.length
      ? "Ninguna categoría asignada es visible. Una categoría y todas sus categorías superiores deben estar publicadas. Publicalas desde Categorías o asigná otra categoría visible y guardá la selección."
      : "No hay categorías asignadas. En Categorías, seleccioná al menos una categoría visible y guardá la selección. Una categoría es visible cuando ella y todas sus categorías superiores están publicadas." });
  const main = row.images?.find(image => image.role === "MAIN");
  if (!main)
    issues.push({ tab: "images", message: "Falta la imagen principal. En Imágenes, subí una imagen o elegí una existente, asignale la función Imagen principal y guardá los cambios." });
  else if (!main.altText?.trim())
    issues.push({ tab: "images", message: "La imagen principal no tiene texto alternativo. En Imágenes, agregá una descripción de lo que muestra la imagen y guardá los detalles." });
  return issues;
}
