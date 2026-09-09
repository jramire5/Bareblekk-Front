import { useEffect, useRef, useState } from "react";
import { allRecords, apiBase, recordPath, request } from "../lib/api";
import {
  allowedStatuses,
  resources,
  statusLabels,
  type CatalogRecord,
  type Lookups,
  type Resource,
  type Status,
} from "../lib/catalog";
import RecordForm from "./RecordForm";
import ProductDetails from "./ProductDetails";

type Props = {
  resource: Resource;
  id?: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
};
export default function EntityEditor({
  resource,
  id,
  canEdit,
  onClose,
  onSaved,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    [recordId, setRecordId] = useState(id),
    [row, setRow] = useState<CatalogRecord | null>(null);
  const [lookups, setLookups] = useState<Lookups>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dirty, setDirty] = useState(false),
    [tab, setTab] = useState("information"),
    [revision, setRevision] = useState(0),
    [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");
  const config = resources[resource];
  function close() {
    if (!busy && (!dirty || window.confirm("Discard your unsaved changes?")))
      onClose();
  }
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const needed: Resource[] =
      resource === "products"
        ? [
            "brands",
            "product-lines",
            "categories",
            "applications",
            "tags",
            "attributes",
          ]
        : resource === "categories"
          ? ["categories"]
          : resource === "product-lines"
            ? ["brands"]
            : resource === "downloads"
              ? ["products", "product-lines"]
              : [];
    Promise.all([
      recordId
        ? request<{ data: CatalogRecord }>(recordPath(resource, recordId), {
            signal: controller.signal,
          }).then((r) => r.data)
        : Promise.resolve(null),
      Promise.all(
        needed.map(
          async (key) =>
            [key, await allRecords(key, controller.signal)] as const,
        ),
      ),
    ])
      .then(([record, lists]) => {
        if (!controller.signal.aborted) {
          setRow(record);
          setLookups(Object.fromEntries(lists));
          setDirty(false);
          setRevision((x) => x + 1);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [resource, recordId, reload]);
  async function mutate(
    path: string,
    body: unknown,
    method = "PUT",
    success = "Changes saved.",
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, { method, body, version: row?.version });
      setDirty(false);
      onSaved(success);
      setMessage(success);
      if (recordId) {
        try {
          const latest = await request<{ data: CatalogRecord }>(
            recordPath(resource, recordId),
          );
          setRow(latest.data);
          setRevision((x) => x + 1);
        } catch {
          setError(
            "Your change was saved, but the latest record could not be loaded. Reload before making another change.",
          );
          setRow(null);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(body: unknown) {
    if (row) return mutate(recordPath(resource, row.id), body, "PATCH");
    setBusy(true);
    setError("");
    try {
      const result = await request<{ data: CatalogRecord }>(
        recordPath(resource),
        { method: "POST", body },
      );
      setDirty(false);
      setRecordId(result.data.id);
      setRow(result.data);
      setMessage(
        resource === "attributes"
          ? "Attribute created. You can now use it in product specifications."
          : "Created as a draft. Add the remaining details before publishing.",
      );
      onSaved(
        `${config.singular[0].toUpperCase() + config.singular.slice(1)} created.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function switchTab(value: string) {
    if (
      busy ||
      (dirty && !window.confirm("Discard unsaved changes in this section?"))
    )
      return;
    setDirty(false);
    setError("");
    setMessage("");
    setTab(value);
    setRevision((x) => x + 1);
  }
  function changeStatus(status: Status) {
    if (!row) return;
    if (
      dirty &&
      !window.confirm(
        "Discard unsaved changes and change this record’s status?",
      )
    )
      return;
    if (
      status === "ARCHIVED" &&
      !window.confirm(
        `Archive “${row.name || row.title}”? It will be removed from the public catalog. You can restore it later.`,
      )
    )
      return;
    void mutate(
      recordPath(resource, row.id) + "/status",
      { status },
      "PUT",
      `${config.singular[0].toUpperCase() + config.singular.slice(1)} ${statusLabels[status].toLowerCase()}.`,
    );
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      aria-labelledby="editor-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="editor-header">
        <div>
          <p className="eyebrow">{config.label}</p>
          <h2 id="editor-title">
            {recordId
              ? row?.name || row?.title || "Record details"
              : "Add " + config.singular}
          </h2>
        </div>
        <button aria-label="Close editor" onClick={close} disabled={busy}>
          ✕
        </button>
      </header>
      <div className="editor-body">
        {loading ? (
          <p role="status">Loading details…</p>
        ) : (
          <>
            {error && (
              <div className="notice error" role="alert">
                {error}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !dirty ||
                      window.confirm(
                        "Discard your changes and reload the latest record?",
                      )
                    ) {
                      setDirty(false);
                      setReload((x) => x + 1);
                    }
                  }}
                >
                  Reload record
                </button>
              </div>
            )}
            {message && (
              <div className="notice success" role="status">
                {message}
              </div>
            )}
            {(!recordId || row) && (
              <>
                {row && (
                  <section className="status-panel">
                    <div>
                      <span className="eyebrow">
                        {resource === "attributes"
                          ? "AVAILABILITY"
                          : "PUBLICATION"}
                      </span>
                      <strong>
                        {resource === "attributes"
                          ? row.active
                            ? "Active"
                            : "Inactive"
                          : statusLabels[row.status]}
                      </strong>
                    </div>
                    {canEdit && (
                      <div className="status-actions">
                        {resource === "attributes" ? (
                          <button
                            disabled={busy || dirty}
                            onClick={() =>
                              void mutate(
                                recordPath(resource, row.id) + "/active",
                                { active: !row.active },
                                "PUT",
                                row.active
                                  ? "Attribute deactivated."
                                  : "Attribute activated.",
                              )
                            }
                          >
                            {row.active ? "Deactivate" : "Activate"}
                          </button>
                        ) : (
                          allowedStatuses(row.status).map((value) => (
                            <button
                              key={value}
                              disabled={busy}
                              className={
                                value === "ARCHIVED" ? "danger-text" : ""
                              }
                              onClick={() => changeStatus(value)}
                            >
                              {value === "PUBLISHED"
                                ? "Publish"
                                : value === "ARCHIVED"
                                  ? "Archive"
                                  : row.status === "ARCHIVED"
                                    ? "Restore draft"
                                    : "Unpublish"}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                )}
                {row && resource === "products" && (
                  <>
                    <div className="hint">
                      To publish: add a short description, assign a visible
                      category, and upload a main image with alternative text.
                    </div>
                    <nav className="editor-tabs" aria-label="Product sections">
                      {[
                        "information",
                        "categories",
                        "applications",
                        "tags",
                        "stock",
                        "specifications",
                        "images",
                        "videos",
                      ].map((value) => (
                        <button
                          key={value}
                          aria-current={tab === value ? "page" : undefined}
                          onClick={() => switchTab(value)}
                          disabled={busy}
                        >
                          {value[0].toUpperCase() + value.slice(1)}
                        </button>
                      ))}
                    </nav>
                  </>
                )}
                {row && resource === "downloads" && (
                  <a
                    className="button"
                    href={`${apiBase}${recordPath(resource, row.id)}/file`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download current PDF ↗
                  </a>
                )}
                <div onChange={() => setDirty(true)} key={revision}>
                  {tab === "information" || resource !== "products" || !row ? (
                    <RecordForm
                      resource={resource}
                      row={row}
                      lookups={lookups}
                      disabled={busy || !canEdit}
                      onSave={save}
                    />
                  ) : (
                    <ProductDetails
                      tab={tab}
                      row={row}
                      lookups={lookups}
                      disabled={busy || !canEdit}
                      markDirty={() => setDirty(true)}
                      mutate={mutate}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <footer className="editor-footer">
        <span>
          {dirty
            ? "● Unsaved changes"
            : canEdit
              ? "Changes are saved to the catalog"
              : "Read-only access"}
        </span>
        <button onClick={close} disabled={busy}>
          Close
        </button>
      </footer>
    </dialog>
  );
}
