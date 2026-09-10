import { useState, type SyntheticEvent } from "react";
import { apiBase, recordPath } from "../lib/api";
import {
  specPayload,
  tabLabels,
  statusLabels,
  type CatalogRecord,
  type Lookups,
  type Spec,
} from "../lib/catalog";

type Props = {
  tab: string;
  row: CatalogRecord;
  lookups: Lookups;
  disabled: boolean;
  markDirty: () => void;
  mutate: (
    path: string,
    body: unknown,
    method?: string,
    success?: string,
  ) => Promise<void>;
};
export default function ProductDetails({
  tab,
  row,
  lookups,
  disabled,
  markDirty,
  mutate,
}: Props) {
  const path = recordPath("products", row.id),
    [error, setError] = useState("");
  const [specs, setSpecs] = useState<Spec[]>(row.specifications ?? []);
  function patchSpec(index: number, patch: Partial<Spec>) {
    setSpecs((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    markDirty();
  }
  function submit(
    event: SyntheticEvent<HTMLFormElement>,
    action: (data: FormData) => void,
  ) {
    event.preventDefault();
    setError("");
    action(new FormData(event.currentTarget));
  }
  const saveButton = (
    <div className="form-actions">
      <button type="submit" className="primary">
        Guardar {tabLabels[tab].toLowerCase()}
      </button>
    </div>
  );
  if (tab === "categories" || tab === "applications" || tab === "tags") {
    const selected = new Set<string>(
      tab === "categories"
        ? row.categories?.map((x) => x.categoryId)
        : tab === "applications"
          ? row.applications?.map((x) => x.applicationId)
          : row.tags?.map((x) => x.tagId),
    );
    const choices = (lookups[tab] ?? []).filter(
      (x) => x.status !== "ARCHIVED" || selected.has(x.id),
    );
    return (
      <form
        onSubmit={(e) =>
          submit(
            e,
            (data) =>
              void mutate(path + "/" + tab, { ids: data.getAll("ids") }),
          )
        }
      >
        <fieldset disabled={disabled}>
          <div className="section-title">
            <h3>Asignar {tabLabels[tab].toLowerCase()}</h3>
            <p>Elegí las {tabLabels[tab].toLowerCase()} asociadas a esta impresora.</p>
          </div>
          {choices.length ? (
            <div className="choice-list">
              {choices.map((item) => (
                <label className="checkbox" key={item.id}>
                  <input
                    name="ids"
                    type="checkbox"
                    value={item.id}
                    defaultChecked={selected.has(item.id)}
                  />
                  <span>
                    {item.name}
                    <small>
                      {item.status === "ARCHIVED"
                        ? "Archivado — asociación existente"
                        : tab === "categories"
                          ? item.isVisible
                            ? "Categoría visible"
                            : "No visible en el catálogo"
                          : statusLabels[item.status]}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="hint">
              No hay {tabLabels[tab].toLowerCase()} disponibles. Crealas primero desde el menú de navegación.
            </p>
          )}
          {saveButton}
        </fieldset>
      </form>
    );
  }
  if (tab === "stock")
    return (
      <form
        onSubmit={(e) =>
          submit(
            e,
            (data) =>
              void mutate(path + "/stock", {
                quantity:
                  data.get("quantity") === ""
                    ? null
                    : Number(data.get("quantity")),
              }),
          )
        }
      >
        <fieldset disabled={disabled}>
          <div className="section-title">
            <h3>Disponibilidad de existencias</h3>
            <p>Indicá la cantidad disponible de este modelo.</p>
          </div>
          <label>
            Cantidad
            <input
              name="quantity"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              defaultValue={row.stockQuantity ?? ""}
            />
            <small>
              Dejá el campo vacío si desconocés la cantidad. Cero indica que no hay existencias.
            </small>
          </label>
          {saveButton}
        </fieldset>
      </form>
    );
  if (tab === "specifications")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            const items = specPayload(specs, lookups.attributes ?? []);
            void mutate(path + "/specifications", { items });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <fieldset disabled={disabled}>
          <div className="section-title">
            <h3>Especificaciones técnicas</h3>
            <p>Armá una ficha técnica clara y fácil de comparar.</p>
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {specs.map((spec, index) => {
            const attribute = lookups.attributes?.find(
              (a) => a.id === spec.attributeId,
            );
            return (
              <div className="spec-card" key={index}>
                <div className="form-grid">
                  <label>
                    Atributo *
                    <select
                      required
                      value={spec.attributeId}
                      onChange={(e) =>
                        patchSpec(index, {
                          attributeId: e.target.value,
                          textValue: "",
                          numberValue: null,
                          booleanValue: false,
                        })
                      }
                    >
                      <option value="">Elegí un atributo</option>
                      {lookups.attributes
                        ?.filter(
                          (a) =>
                            (a.active || a.id === spec.attributeId) &&
                            !specs.some(
                              (s, i) => i !== index && s.attributeId === a.id,
                            ),
                        )
                        .map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.name}
                            {a.unit ? ` (${a.unit})` : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Valor *
                    {attribute?.type === "BOOLEAN" ? (
                      <select
                        value={String(spec.booleanValue ?? false)}
                        onChange={(e) =>
                          patchSpec(index, {
                            booleanValue: e.target.value === "true",
                          })
                        }
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    ) : attribute?.type === "ENUM" ? (
                      <select
                        required
                        value={spec.textValue ?? ""}
                        onChange={(e) =>
                          patchSpec(index, { textValue: e.target.value })
                        }
                      >
                        <option value="">Elegí un valor</option>
                        {attribute.allowedValues?.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    ) : attribute?.type === "NUMBER" ? (
                      <input
                        required
                        type="number"
                        step="0.0001"
                        min={-9999999999.9999}
                        max={9999999999.9999}
                        value={spec.numberValue ?? ""}
                        onChange={(e) =>
                          patchSpec(index, { numberValue: e.target.value })
                        }
                      />
                    ) : (
                      <input
                        required
                        maxLength={500}
                        value={spec.textValue ?? ""}
                        onChange={(e) =>
                          patchSpec(index, { textValue: e.target.value })
                        }
                      />
                    )}
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    Grupo
                    <input
                      maxLength={100}
                      value={spec.groupName ?? ""}
                      onChange={(e) =>
                        patchSpec(index, { groupName: e.target.value })
                      }
                      placeholder="Ej.: Rendimiento de impresión"
                    />
                  </label>
                  <label>
                    Orden
                    <input
                      type="number"
                      required
                      min={0}
                      step={1}
                      value={spec.sortOrder}
                      onChange={(e) =>
                        patchSpec(index, { sortOrder: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    setSpecs((items) => items.filter((_, i) => i !== index));
                    markDirty();
                  }}
                >
                  Quitar especificación
                </button>
              </div>
            );
          })}
          {!specs.length && (
            <p className="hint">
              Todavía no hay especificaciones. Primero definí los atributos técnicos
              y después asigná sus valores aquí.
            </p>
          )}
          <button
            type="button"
            disabled={
              !lookups.attributes?.some(
                (a) => a.active && !specs.some((s) => s.attributeId === a.id),
              ) || specs.length >= 100
            }
            onClick={() => {
              setSpecs((items) => [
                ...items,
                {
                  attributeId: "",
                  textValue: "",
                  numberValue: null,
                  booleanValue: false,
                  groupName: "",
                  sortOrder: items.length,
                },
              ]);
              markDirty();
            }}
          >
            ＋ Agregar especificación
          </button>
          {saveButton}
        </fieldset>
      </form>
    );
  if (tab === "images")
    return (
      <div>
        <div className="section-title">
          <h3>Imágenes del producto</h3>
          <p>
            Elegí una imagen principal clara para el catálogo y vistas adicionales
            para la galería.
          </p>
        </div>
        {row.images?.map((item) => (
          <form
            className="media-card"
            key={item.id}
            onSubmit={(e) =>
              submit(
                e,
                (data) =>
                  void mutate(
                    `${path}/images/${item.id}`,
                    {
                      altText: data.get("altText"),
                      role: data.get("role"),
                      sortOrder: Number(data.get("sortOrder")),
                    },
                    "PATCH",
                  ),
              )
            }
          >
            <img
              className="product-image"
              src={`${apiBase}${path}/images/${item.id}/file`}
              alt={item.altText}
              loading="lazy"
            />
            <fieldset disabled={disabled}>
              <label>
                Texto alternativo *
                <input
                  name="altText"
                  required
                  maxLength={300}
                  defaultValue={item.altText}
                />
              </label>
              <div className="form-grid">
                <label>
                  Función
                  <select name="role" defaultValue={item.role}>
                    <option value="MAIN">Imagen principal</option>
                    <option value="GALLERY">Galería</option>
                  </select>
                </label>
                <label>
                  Orden
                  <input
                    name="sortOrder"
                    type="number"
                    min={0}
                    step={1}
                    required
                    defaultValue={item.sortOrder}
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button type="submit">Guardar detalles de imagen</button>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    if (window.confirm("¿Eliminar esta imagen de forma permanente?"))
                      void mutate(
                        `${path}/images/${item.id}`,
                        undefined,
                        "DELETE",
                        "Imagen eliminada.",
                      );
                  }}
                >
                  Eliminar imagen
                </button>
              </div>
            </fieldset>
          </form>
        ))}
        <form
          className="upload-card"
          onSubmit={(e) =>
            submit(e, (data) => {
              const file = data.get("file") as File;
              if (
                !file?.size ||
                file.size > 10 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setError("Elegí una imagen JPEG, PNG o WebP de hasta 10 MB.");
                return;
              }
              void mutate(path + "/images", data, "POST", "Imagen subida.");
            })
          }
        >
          <fieldset disabled={disabled}>
            <h3>Subir una imagen</h3>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <label>
              Archivo de imagen *
              <input
                type="file"
                name="file"
                required
                accept="image/jpeg,image/png,image/webp"
              />
              <small>JPEG, PNG o WebP · hasta 10 MB</small>
            </label>
            <label>
              Texto alternativo *
              <input
                name="altText"
                maxLength={300}
                required
                placeholder="Describí la impresora y la vista que se muestra"
              />
            </label>
            <label>
              Función
              <select
                name="role"
                defaultValue={row.images?.length ? "GALLERY" : "MAIN"}
              >
                <option value="MAIN">Imagen principal</option>
                <option value="GALLERY">Galería</option>
              </select>
            </label>
            <input
              name="sortOrder"
              type="hidden"
              value={row.images?.length ?? 0}
            />
            <button className="primary" type="submit">
              Subir imagen
            </button>
          </fieldset>
        </form>
      </div>
    );
  if (tab === "videos") {
    const videoFields = (
      item?: NonNullable<CatalogRecord["videos"]>[number],
    ) => (
      <>
        <label>
          Título *
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={item?.title ?? ""}
          />
        </label>
        <label>
          URL del video *
          <input
            name="url"
            type="url"
            required
            maxLength={2048}
            defaultValue={item?.url ?? ""}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </label>
        <div className="form-grid">
          <label>
            Proveedor
            <select name="provider" defaultValue={item?.provider ?? "YOUTUBE"}>
              <option value="YOUTUBE">YouTube</option>
              <option value="VIMEO">Vimeo</option>
            </select>
          </label>
          <label>
            Orden
            <input
              name="sortOrder"
              type="number"
              required
              min={0}
              step={1}
              defaultValue={item?.sortOrder ?? row.videos?.length ?? 0}
            />
          </label>
        </div>
      </>
    );
    const saveVideo = (data: FormData, id?: string) => {
      const body = {
        title: data.get("title"),
        url: String(data.get("url")),
        provider: data.get("provider"),
        sortOrder: Number(data.get("sortOrder")),
      };
      const url = new URL(body.url),
        hosts =
          body.provider === "YOUTUBE"
            ? ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"]
            : ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !hosts.includes(url.hostname)
      ) {
        setError("Usá una URL de YouTube o Vimeo que coincida con el proveedor seleccionado.");
        return;
      }
      void mutate(
        path + "/videos" + (id ? "/" + id : ""),
        body,
        id ? "PATCH" : "POST",
        "Video guardado.",
      );
    };
    return (
      <div>
        <div className="section-title">
          <h3>Videos del producto</h3>
          <p>Vinculá demostraciones de YouTube o Vimeo.</p>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {row.videos?.map((item) => (
          <form
            className="spec-card"
            key={item.id}
            onSubmit={(e) => submit(e, (data) => saveVideo(data, item.id))}
          >
            <fieldset disabled={disabled}>
              {videoFields(item)}
              <div className="inline-actions">
                <button type="submit">Guardar video</button>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar “${item.title}”?`))
                      void mutate(
                        path + "/videos/" + item.id,
                        undefined,
                        "DELETE",
                        "Video eliminado.",
                      );
                  }}
                >
                  Eliminar video
                </button>
              </div>
            </fieldset>
          </form>
        ))}
        <form
          className="upload-card"
          onSubmit={(e) => submit(e, (data) => saveVideo(data))}
        >
          <fieldset disabled={disabled}>
            <h3>Agregar video</h3>
            {videoFields()}
            <button type="submit" className="primary">
              Agregar video
            </button>
          </fieldset>
        </form>
      </div>
    );
  }
  return null;
}
