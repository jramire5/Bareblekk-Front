import { useEffect, useRef, useState } from "react";
import { allRecords, apiBase, recordPath, request } from "../lib/api";
import {
  allowedStatuses,
  resources,
  statusLabels,
  tabLabels,
  type CatalogRecord,
  type Lookups,
  type Resource,
  type Status,
} from "../lib/catalog";
import RecordForm from "./RecordForm";
import ProductDetails from "./ProductDetails";
import { publicationIssues } from "../lib/publication";

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
  const issues = row && resource === "products"
    ? publicationIssues(row, lookups.categories ?? []) : [];
  function close() {
    if (!busy && (!dirty || window.confirm("¿Descartar los cambios sin guardar?")))
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
    success = "Cambios guardados.",
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
            "El cambio se guardó, pero no se pudo cargar el registro actualizado. Recargalo antes de hacer otro cambio.",
          );
          setRow(null);
        }
      }
    } catch (e) {
      const publishing = path.endsWith("/status") && (body as { status?: string })?.status === "PUBLISHED";
      setError(`${publishing ? "No se pudo publicar el registro." : method === "DELETE" ? "No se pudo eliminar el elemento." : "No se pudo guardar el cambio."} ${(e as Error).message}`);
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
          ? "Atributo creado. Ya podés usarlo en las especificaciones de productos."
          : "Registro creado como borrador. Completá los detalles antes de publicar.",
      );
      onSaved(
        "Registro creado.",
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
      (dirty && !window.confirm("¿Descartar los cambios sin guardar de esta sección?"))
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
        "¿Descartar los cambios sin guardar y cambiar el estado del registro?",
      )
    )
      return;
    if (
      status === "ARCHIVED" &&
      !window.confirm(
        `¿Archivar “${row.name || row.title}”? Se quitará del catálogo público. Podés restaurarlo más adelante.`,
      )
    )
      return;
    void mutate(
      recordPath(resource, row.id) + "/status",
      { status },
      "PUT",
      `Estado actualizado: ${statusLabels[status].toLowerCase()}.`,
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
              ? row?.name || row?.title || "Detalles del registro"
              : "Agregar " + config.singular}
          </h2>
        </div>
        <button aria-label="Cerrar editor" onClick={close} disabled={busy}>
          ✕
        </button>
      </header>
      <div className="editor-body">
        {loading ? (
          <p role="status">Cargando detalles…</p>
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
                        "¿Descartar tus cambios y cargar la última versión del registro?",
                      )
                    ) {
                      setDirty(false);
                      setReload((x) => x + 1);
                    }
                  }}
                >
                  Recargar registro
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
                          ? "DISPONIBILIDAD"
                          : "PUBLICACIÓN"}
                      </span>
                      <strong>
                        {resource === "attributes"
                          ? row.active
                            ? "Activo"
                            : "Inactivo"
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
                                  ? "Atributo desactivado."
                                  : "Atributo activado.",
                              )
                            }
                          >
                            {row.active ? "Desactivar" : "Activar"}
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
                                ? "Publicar"
                                : value === "ARCHIVED"
                                  ? "Archivar"
                                  : row.status === "ARCHIVED"
                                    ? "Restaurar borrador"
                                    : "Retirar publicación"}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                )}
                {row && resource === "products" && (
                  <>
                    <section className="hint" aria-label="Requisitos de publicación">
                      <strong>{issues.length ? "Pendientes para publicar este producto" : "Requisitos de publicación completos"}</strong>
                      <p>Esta revisión usa los datos guardados. El servidor vuelve a validarlos al publicar.</p>
                      {dirty && <p>Tenés cambios sin guardar. Guardalos para actualizar esta revisión.</p>}
                      {row.status === "ARCHIVED" && <p>El producto está archivado. Primero usá «Restaurar borrador» para poder publicarlo.</p>}
                      {issues.length > 0 && <ul>{issues.map((issue, index) => (
                        <li key={index}>
                          <p>{issue.message}</p>
                          <button type="button" disabled={busy} onClick={() => switchTab(issue.tab)}>
                            Ir a {tabLabels[issue.tab]}
                          </button>
                        </li>
                      ))}</ul>}
                    </section>
                    <nav className="editor-tabs" aria-label="Secciones del producto">
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
                          {tabLabels[value]}
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
                    Descargar PDF actual ↗
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
            ? "● Cambios sin guardar"
            : canEdit
              ? "Los cambios se guardan en el catálogo"
              : "Acceso de solo lectura"}
        </span>
        <button onClick={close} disabled={busy}>
          Cerrar
        </button>
      </footer>
    </dialog>
  );
}
