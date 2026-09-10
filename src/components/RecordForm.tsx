import { useState, type SyntheticEvent } from "react";
import {
  categoryParents,
  slugify,
  type CatalogRecord,
  type Lookups,
  type Resource,
} from "../lib/catalog";

type Props = {
  resource: Resource;
  row: CatalogRecord | null;
  lookups: Lookups;
  disabled: boolean;
  onSave: (body: unknown) => Promise<void>;
};
export default function RecordForm({
  resource,
  row,
  lookups,
  disabled,
  onSave,
}: Props) {
  const [name, setName] = useState(row?.name || row?.title || ""),
    [slug, setSlug] = useState(row?.slug ?? ""),
    [slugEdited, setSlugEdited] = useState(!!row);
  const [brand, setBrand] = useState(row?.brandId ?? ""),
    [line, setLine] = useState(row?.productLineId ?? ""),
    [type, setType] = useState(
      row?.type ?? (resource === "attributes" ? "TEXT" : "BROCHURE"),
    );
  const [owner, setOwner] = useState(
    row?.productId ? "product" : row?.productLineId ? "line" : "general",
  );
  const [error, setError] = useState("");
  const product = resource === "products",
    attribute = resource === "attributes",
    document = resource === "downloads";
  const options = (
    key: Resource,
    selected?: string | null,
    rows = lookups[key] ?? [],
  ) =>
    rows
      .filter((x) => x.status !== "ARCHIVED" || x.id === selected)
      .map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
          {x.status === "ARCHIVED" ? " (archivado)" : ""}
        </option>
      ));
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget),
      text = (key: string) => String(data.get(key) ?? "").trim(),
      nullable = (key: string) => text(key) || null;
    let body: Record<string, unknown> = {};
    if (attribute) {
      body = {
        name: name.trim(),
        code: text("code"),
        type,
        unit: type === "NUMBER" ? nullable("unit") : null,
        allowedValues:
          type === "ENUM"
            ? text("allowedValues")
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean)
            : [],
        filterable: type !== "TEXT" && data.has("filterable"),
        sortOrder: Number(text("sortOrder")),
      };
      if (type === "ENUM" && !(body.allowedValues as string[]).length) {
        setError("Agregá al menos un valor permitido.");
        return;
      }
      if (
        new Set(body.allowedValues as string[]).size !==
        (body.allowedValues as string[]).length
      ) {
        setError("Los valores permitidos no pueden repetirse.");
        return;
      }
    } else if (document) {
      body = {
        title: name.trim(),
        description: nullable("description"),
        type,
        productId: owner === "product" ? text("productId") : null,
        productLineId: owner === "line" ? text("productLineId") : null,
        sortOrder: Number(text("sortOrder")),
      };
      if (!row) {
        const file = data.get("file") as File;
        if (
          !file?.size ||
          file.size > 25 * 1024 * 1024 ||
          file.type !== "application/pdf"
        ) {
          setError("Elegí un archivo PDF de hasta 25 MB.");
          return;
        }
        const form = new FormData();
        form.set("metadata", JSON.stringify(body));
        form.set("file", file);
        await onSave(form);
        return;
      }
    } else {
      body = { name: name.trim(), slug };
      if (resource !== "tags") body.description = nullable("description");
      if (!product) body.sortOrder = Number(text("sortOrder"));
      if (product || resource === "product-lines") body.brandId = brand;
      if (product)
        Object.assign(body, {
          productLineId: line || null,
          sku: nullable("sku"),
          shortDescription: nullable("shortDescription"),
          lifecycle: text("lifecycle"),
          isFeatured: data.has("isFeatured"),
          seoTitle: nullable("seoTitle"),
          seoDescription: nullable("seoDescription"),
        });
      if (resource === "categories") body.parentId = nullable("parentId");
    }
    await onSave(body);
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={disabled}>
        <div className="section-title">
          <h3>
            {product
              ? "Información del producto"
              : attribute
                ? "Definición del atributo"
                : document
                  ? "Información del documento"
                  : "Información básica"}
          </h3>
          <p>Los campos marcados con * son obligatorios.</p>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <label>
          {document ? "Título" : "Nombre"} *
          <input
            name="name"
            value={name}
            required
            maxLength={product || document ? 200 : 160}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            placeholder={product ? "Ej.: Mimaki UJF-6042 MkII e" : undefined}
          />
        </label>
        {!attribute && !document && (
          <label>
            Identificador de URL *
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={product ? 220 : 180}
              value={slug}
              readOnly={!!row?.publishedAt}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value);
              }}
            />
            <small>
              {row?.publishedAt
                ? "El identificador de URL queda fijo después de la primera publicación."
                : "Letras minúsculas, números y guiones. Se usa en las URL del catálogo."}
            </small>
          </label>
        )}
        {(product || resource === "product-lines") && (
          <label>
            Marca *
            <select
              name="brandId"
              required
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setLine("");
              }}
            >
              <option value="">Elegí una marca</option>
              {options("brands", row?.brandId)}
            </select>
            {!lookups.brands?.length && (
              <small>
                Creá una marca antes de agregar productos o líneas de productos.
              </small>
            )}
          </label>
        )}
        {product && (
          <>
            <div className="form-grid">
              <label>
                Línea de productos
                <select
                  name="productLineId"
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                >
                  <option value="">Sin línea de productos</option>
                  {options(
                    "product-lines",
                    row?.productLineId,
                    (lookups["product-lines"] ?? []).filter(
                      (x) => x.brandId === brand,
                    ),
                  )}
                </select>
              </label>
              <label>
                SKU
                <input
                  name="sku"
                  defaultValue={row?.sku ?? ""}
                  maxLength={100}
                />
              </label>
            </div>
            <label>
              Descripción breve
              <textarea
                name="shortDescription"
                defaultValue={row?.shortDescription ?? ""}
                maxLength={500}
                rows={3}
                required={row?.status === "PUBLISHED"}
              />
              <small>
                Un resumen breve. Obligatorio para publicar (hasta 500
                caracteres).
              </small>
            </label>
          </>
        )}
        {resource === "categories" && (
          <label>
            Categoría superior
            <select name="parentId" defaultValue={row?.parentId ?? ""}>
              <option value="">Categoría principal</option>
              {options(
                "categories",
                row?.parentId,
                categoryParents(lookups.categories ?? [], row?.id),
              )}
            </select>
            <small>
              Una categoría es visible solo cuando ella y todas sus categorías superiores
              están publicadas.
            </small>
          </label>
        )}
        {!attribute && resource !== "tags" && (
          <label>
            Descripción
            <textarea
              name="description"
              defaultValue={row?.description ?? ""}
              maxLength={50000}
              rows={5}
            />
          </label>
        )}
        {product && (
          <>
            <div className="form-grid">
              <label>
                Ciclo de vida
                <select
                  name="lifecycle"
                  defaultValue={row?.lifecycle ?? "ACTIVE"}
                >
                  <option value="ACTIVE">Modelo activo</option>
                  <option value="DISCONTINUED">Modelo descontinuado</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  name="isFeatured"
                  type="checkbox"
                  defaultChecked={row?.isFeatured}
                />
                Producto destacado
              </label>
            </div>
            <details>
              <summary>Información para buscadores</summary>
              <label>
                Título SEO
                <input
                  name="seoTitle"
                  defaultValue={row?.seoTitle ?? ""}
                  maxLength={200}
                />
              </label>
              <label>
                Descripción SEO
                <textarea
                  name="seoDescription"
                  defaultValue={row?.seoDescription ?? ""}
                  maxLength={500}
                />
              </label>
            </details>
          </>
        )}
        {attribute && (
          <>
            <label>
              Código *
              <input
                name="code"
                defaultValue={row?.code ?? ""}
                required
                maxLength={100}
                pattern="[a-z][a-z0-9_]*"
              />
              <small>
                Letras minúsculas, números y guiones bajos; debe empezar con una
                letra.
              </small>
            </label>
            <label>
              Tipo de valor
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="TEXT">Texto</option>
                <option value="NUMBER">Número</option>
                <option value="BOOLEAN">Sí / no</option>
                <option value="ENUM">Opción de una lista</option>
              </select>
            </label>
            {type === "NUMBER" && (
              <label>
                Unidad
                <input
                  name="unit"
                  defaultValue={row?.unit ?? ""}
                  maxLength={30}
                  placeholder="Ej.: mm, dpi, m²/h"
                />
              </label>
            )}
            {type === "ENUM" && (
              <label>
                Valores permitidos *
                <textarea
                  name="allowedValues"
                  required
                  defaultValue={row?.allowedValues?.join("\n") ?? ""}
                  rows={5}
                />
                <small>
                  Un valor por línea; hasta 100 valores de 100 caracteres cada uno.
                </small>
              </label>
            )}
            {type !== "TEXT" && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="filterable"
                  defaultChecked={row?.filterable}
                />
                Usar como filtro del catálogo
              </label>
            )}
            {row && (
              <p className="hint">
                Los atributos utilizados por productos tienen restricciones para cambiar
                su código, tipo, unidad y opciones existentes.
              </p>
            )}
          </>
        )}
        {document && (
          <>
            <label>
              Tipo de documento
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="BROCHURE">Folleto</option>
                <option value="DATASHEET">Ficha técnica</option>
                <option value="MANUAL">Manual</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
            <label>
              Pertenece a
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="general">Catálogo general</option>
                <option value="product">Un producto</option>
                <option value="line">Una línea de productos</option>
              </select>
            </label>
            {owner === "product" && (
              <label>
                Producto *
                <select
                  name="productId"
                  required
                  defaultValue={row?.productId ?? ""}
                >
                  <option value="">Elegí un producto</option>
                  {options("products", row?.productId)}
                </select>
              </label>
            )}
            {owner === "line" && (
              <label>
                Línea de productos *
                <select
                  name="productLineId"
                  required
                  defaultValue={row?.productLineId ?? ""}
                >
                  <option value="">Elegí una línea</option>
                  {options("product-lines", row?.productLineId)}
                </select>
              </label>
            )}
            {!row && (
              <label>
                Archivo PDF *
                <input
                  type="file"
                  name="file"
                  accept="application/pdf"
                  required
                />
                <small>Máximo 25 MB.</small>
              </label>
            )}
            {row && (
              <p className="hint">
                Cambiar la asociación de un documento publicado lo devuelve a borrador.
              </p>
            )}
          </>
        )}
        {!product && (
          <label>
            Orden de visualización
            <input
              type="number"
              name="sortOrder"
              min={0}
              step={1}
              required
              defaultValue={row?.sortOrder ?? 0}
            />
          </label>
        )}
        <div className="form-actions">
          <button type="submit" className="primary">
            {row
              ? "Guardar cambios"
              : "Crear " +
                (product
                  ? "producto"
                  : attribute
                    ? "atributo"
                    : document
                      ? "documento"
                      : "registro")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
