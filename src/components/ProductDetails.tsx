import { useState, type SyntheticEvent } from "react";
import { apiBase, recordPath } from "../lib/api";
import {
  specPayload,
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
        Save {tab}
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
            <h3>Assign {tab}</h3>
            <p>Choose the {tab} associated with this printer.</p>
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
                        ? "Archived — existing association"
                        : tab === "categories"
                          ? item.isVisible
                            ? "Visible category"
                            : "Not visible in catalog"
                          : item.status.toLowerCase()}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="hint">
              No {tab} available. Create them from the navigation menu first.
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
            <h3>Stock availability</h3>
            <p>Set the available quantity for this model.</p>
          </div>
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              defaultValue={row.stockQuantity ?? ""}
            />
            <small>
              Leave blank for unknown stock. Zero means out of stock.
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
            <h3>Technical specifications</h3>
            <p>Build a consistent, comparable technical sheet.</p>
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
                    Attribute *
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
                      <option value="">Choose an attribute</option>
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
                    Value *
                    {attribute?.type === "BOOLEAN" ? (
                      <select
                        value={String(spec.booleanValue ?? false)}
                        onChange={(e) =>
                          patchSpec(index, {
                            booleanValue: e.target.value === "true",
                          })
                        }
                      >
                        <option value="true">Yes</option>
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
                        <option value="">Choose a value</option>
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
                    Group
                    <input
                      maxLength={100}
                      value={spec.groupName ?? ""}
                      onChange={(e) =>
                        patchSpec(index, { groupName: e.target.value })
                      }
                      placeholder="e.g. Print performance"
                    />
                  </label>
                  <label>
                    Order
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
                  Remove specification
                </button>
              </div>
            );
          })}
          {!specs.length && (
            <p className="hint">
              No specifications added yet. Define technical attributes first,
              then assign their values here.
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
            ＋ Add specification
          </button>
          {saveButton}
        </fieldset>
      </form>
    );
  if (tab === "images")
    return (
      <div>
        <div className="section-title">
          <h3>Product images</h3>
          <p>
            Choose a clear main image for the catalog and additional gallery
            views.
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
                Alternative text *
                <input
                  name="altText"
                  required
                  maxLength={300}
                  defaultValue={item.altText}
                />
              </label>
              <div className="form-grid">
                <label>
                  Role
                  <select name="role" defaultValue={item.role}>
                    <option value="MAIN">Main image</option>
                    <option value="GALLERY">Gallery</option>
                  </select>
                </label>
                <label>
                  Order
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
                <button type="submit">Save image details</button>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    if (window.confirm("Permanently remove this image?"))
                      void mutate(
                        `${path}/images/${item.id}`,
                        undefined,
                        "DELETE",
                        "Image removed.",
                      );
                  }}
                >
                  Remove image
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
                setError("Choose a JPEG, PNG, or WebP image up to 10 MB.");
                return;
              }
              void mutate(path + "/images", data, "POST", "Image uploaded.");
            })
          }
        >
          <fieldset disabled={disabled}>
            <h3>Upload an image</h3>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <label>
              Image file *
              <input
                type="file"
                name="file"
                required
                accept="image/jpeg,image/png,image/webp"
              />
              <small>JPEG, PNG, or WebP · up to 10 MB</small>
            </label>
            <label>
              Alternative text *
              <input
                name="altText"
                maxLength={300}
                required
                placeholder="Describe the printer and view shown"
              />
            </label>
            <label>
              Role
              <select
                name="role"
                defaultValue={row.images?.length ? "GALLERY" : "MAIN"}
              >
                <option value="MAIN">Main image</option>
                <option value="GALLERY">Gallery</option>
              </select>
            </label>
            <input
              name="sortOrder"
              type="hidden"
              value={row.images?.length ?? 0}
            />
            <button className="primary" type="submit">
              Upload image
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
          Title *
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={item?.title ?? ""}
          />
        </label>
        <label>
          Video URL *
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
            Provider
            <select name="provider" defaultValue={item?.provider ?? "YOUTUBE"}>
              <option value="YOUTUBE">YouTube</option>
              <option value="VIMEO">Vimeo</option>
            </select>
          </label>
          <label>
            Order
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
        setError("Use a YouTube or Vimeo URL matching the selected provider.");
        return;
      }
      void mutate(
        path + "/videos" + (id ? "/" + id : ""),
        body,
        id ? "PATCH" : "POST",
        "Video saved.",
      );
    };
    return (
      <div>
        <div className="section-title">
          <h3>Product videos</h3>
          <p>Link demonstrations from YouTube or Vimeo.</p>
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
                <button type="submit">Save video</button>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    if (window.confirm(`Remove “${item.title}”?`))
                      void mutate(
                        path + "/videos/" + item.id,
                        undefined,
                        "DELETE",
                        "Video removed.",
                      );
                  }}
                >
                  Remove video
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
            <h3>Add video</h3>
            {videoFields()}
            <button type="submit" className="primary">
              Add video
            </button>
          </fieldset>
        </form>
      </div>
    );
  }
  return null;
}
