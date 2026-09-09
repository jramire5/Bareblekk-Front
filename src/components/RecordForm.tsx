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
          {x.status === "ARCHIVED" ? " (archived)" : ""}
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
        setError("Add at least one allowed value.");
        return;
      }
      if (
        new Set(body.allowedValues as string[]).size !==
        (body.allowedValues as string[]).length
      ) {
        setError("Allowed values must be unique.");
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
          setError("Choose a PDF file up to 25 MB.");
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
              ? "Product information"
              : attribute
                ? "Attribute definition"
                : document
                  ? "Document information"
                  : "Basic information"}
          </h3>
          <p>Fields marked with * are required.</p>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <label>
          {document ? "Title" : "Name"} *
          <input
            name="name"
            value={name}
            required
            maxLength={product || document ? 200 : 160}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            placeholder={product ? "e.g. Mimaki UJF-6042 MkII e" : undefined}
          />
        </label>
        {!attribute && !document && (
          <label>
            Slug *
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
                ? "The URL slug is locked after the first publication."
                : "Lowercase letters, numbers, and hyphens. Used in catalog URLs."}
            </small>
          </label>
        )}
        {(product || resource === "product-lines") && (
          <label>
            Brand *
            <select
              name="brandId"
              required
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setLine("");
              }}
            >
              <option value="">Choose a brand</option>
              {options("brands", row?.brandId)}
            </select>
            {!lookups.brands?.length && (
              <small>
                Create a brand before adding products or product lines.
              </small>
            )}
          </label>
        )}
        {product && (
          <>
            <div className="form-grid">
              <label>
                Product line
                <select
                  name="productLineId"
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                >
                  <option value="">No product line</option>
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
              Short description
              <textarea
                name="shortDescription"
                defaultValue={row?.shortDescription ?? ""}
                maxLength={500}
                rows={3}
                required={row?.status === "PUBLISHED"}
              />
              <small>
                A brief overview. Required before publishing (up to 500
                characters).
              </small>
            </label>
          </>
        )}
        {resource === "categories" && (
          <label>
            Parent category
            <select name="parentId" defaultValue={row?.parentId ?? ""}>
              <option value="">Top-level category</option>
              {options(
                "categories",
                row?.parentId,
                categoryParents(lookups.categories ?? [], row?.id),
              )}
            </select>
            <small>
              A category is visible only when it and all its parents are
              published.
            </small>
          </label>
        )}
        {!attribute && resource !== "tags" && (
          <label>
            Description
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
                Lifecycle
                <select
                  name="lifecycle"
                  defaultValue={row?.lifecycle ?? "ACTIVE"}
                >
                  <option value="ACTIVE">Active model</option>
                  <option value="DISCONTINUED">Discontinued model</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  name="isFeatured"
                  type="checkbox"
                  defaultChecked={row?.isFeatured}
                />
                Featured product
              </label>
            </div>
            <details>
              <summary>Search engine information</summary>
              <label>
                SEO title
                <input
                  name="seoTitle"
                  defaultValue={row?.seoTitle ?? ""}
                  maxLength={200}
                />
              </label>
              <label>
                SEO description
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
              Code *
              <input
                name="code"
                defaultValue={row?.code ?? ""}
                required
                maxLength={100}
                pattern="[a-z][a-z0-9_]*"
              />
              <small>
                Lowercase letters, numbers, and underscores; start with a
                letter.
              </small>
            </label>
            <label>
              Value type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
                <option value="BOOLEAN">Yes / no</option>
                <option value="ENUM">Choice from a list</option>
              </select>
            </label>
            {type === "NUMBER" && (
              <label>
                Unit
                <input
                  name="unit"
                  defaultValue={row?.unit ?? ""}
                  maxLength={30}
                  placeholder="e.g. mm, dpi, m²/h"
                />
              </label>
            )}
            {type === "ENUM" && (
              <label>
                Allowed values *
                <textarea
                  name="allowedValues"
                  required
                  defaultValue={row?.allowedValues?.join("\n") ?? ""}
                  rows={5}
                />
                <small>
                  One value per line; up to 100 values of 100 characters each.
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
                Use as a catalog filter
              </label>
            )}
            {row && (
              <p className="hint">
                Attributes already used by products have restrictions on changes
                to their code, type, unit, and existing options.
              </p>
            )}
          </>
        )}
        {document && (
          <>
            <label>
              Document type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="BROCHURE">Brochure</option>
                <option value="DATASHEET">Datasheet</option>
                <option value="MANUAL">Manual</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              Belongs to
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="general">General catalog</option>
                <option value="product">A product</option>
                <option value="line">A product line</option>
              </select>
            </label>
            {owner === "product" && (
              <label>
                Product *
                <select
                  name="productId"
                  required
                  defaultValue={row?.productId ?? ""}
                >
                  <option value="">Choose a product</option>
                  {options("products", row?.productId)}
                </select>
              </label>
            )}
            {owner === "line" && (
              <label>
                Product line *
                <select
                  name="productLineId"
                  required
                  defaultValue={row?.productLineId ?? ""}
                >
                  <option value="">Choose a line</option>
                  {options("product-lines", row?.productLineId)}
                </select>
              </label>
            )}
            {!row && (
              <label>
                PDF file *
                <input
                  type="file"
                  name="file"
                  accept="application/pdf"
                  required
                />
                <small>Maximum 25 MB.</small>
              </label>
            )}
            {row && (
              <p className="hint">
                Changing the owner of a published document returns it to draft.
              </p>
            )}
          </>
        )}
        {!product && (
          <label>
            Display order
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
              ? "Save changes"
              : "Create " +
                (product
                  ? "product"
                  : attribute
                    ? "attribute"
                    : document
                      ? "document"
                      : "record")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
