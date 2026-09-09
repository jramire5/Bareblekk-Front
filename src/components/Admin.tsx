import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { ApiError, recordPath, request } from "../lib/api";
import {
  resources,
  statusLabels,
  type CatalogRecord,
  type Page,
  type Resource,
  type User,
} from "../lib/catalog";
import EntityEditor from "./EntityEditor";

export function Notice({ message }: { message: string }) {
  return (
    <div className="notice error" role="alert">
      {message}
    </div>
  );
}
export function Badge({
  row,
  resource,
}: {
  row: CatalogRecord;
  resource: Resource;
}) {
  const status =
    resource === "attributes"
      ? row.active
        ? "PUBLISHED"
        : "ARCHIVED"
      : row.status;
  return (
    <span className={"badge " + status?.toLowerCase()}>
      <span aria-hidden="true">●</span>
      {resource === "attributes"
        ? row.active
          ? "Active"
          : "Inactive"
        : statusLabels[status]}
    </span>
  );
}
function Login({
  onLogin,
  initialError,
}: {
  onLogin: (u: User) => void;
  initialError: string;
}) {
  const [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  async function login(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await request<{ data: User }>("/auth/login", {
        method: "POST",
        body: { email: data.get("email"), password: data.get("password") },
      });
      onLogin(result.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-brand">
        <a className="brand" href="/">
          bareblekk<span>®</span>
        </a>
        <div>
          <p className="eyebrow">CATALOG WORKSPACE</p>
          <h1>
            Great products.
            <br />
            Clearly presented.
          </h1>
          <p>
            A dedicated space for the printers, details, and expertise behind
            your catalog.
          </p>
        </div>
        <span className="login-foot">BAREBLEKK / ADMINISTRATION</span>
      </section>
      <section className="login-panel">
        <form onSubmit={login}>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your workspace</h2>
          <p className="muted">
            Use your Bareblekk administrator or editor account.
          </p>
          {error && <Notice message={error} />}
          <fieldset disabled={busy}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <button className="primary full" type="submit">
              {busy ? "Signing in…" : "Sign in"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </fieldset>
          <p className="small muted">
            Access is managed by your administrator.
          </p>
        </form>
      </section>
    </main>
  );
}
export default function Admin() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [sessionError, setSessionError] = useState("");
  const [resource, setResource] = useState<Resource>("products");
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<{ id?: string } | null>(null),
    [toast, setToast] = useState(""),
    [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const canEdit = user?.role !== "VIEWER";
  useEffect(() => {
    const controller = new AbortController();
    request<{ data: User }>("/auth/me", { signal: controller.signal })
      .then((r) => setUser(r.data))
      .catch((e) => {
        if (
          !controller.signal.aborted &&
          (!(e instanceof ApiError) || e.status !== 401)
        )
          setSessionError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    const expired = () => {
      setUser(null);
      setEditor(null);
      setResult(null);
      setSessionError(
        "Your session expired. Sign in again to continue. Unsaved changes were not submitted.",
      );
    };
    window.addEventListener("bareblekk:unauthenticated", expired);
    const fromHash = () => {
      const value = location.hash.slice(1);
      if (value in resources) {
        setResource(value as Resource);
        setQuery("");
        setSearch("");
        setStatus("");
        setPage(1);
        setResult(null);
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => {
      controller.abort();
      window.removeEventListener("bareblekk:unauthenticated", expired);
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search && resource !== "attributes" && resource !== "downloads")
      params.set("q", search);
    if (status && resource !== "attributes") params.set("status", status);
    request<Page>(recordPath(resource) + "?" + params, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!controller.signal.aborted) {
          setResult(r);
          if (page > 1 && page > r.meta.totalPages)
            setPage(Math.max(1, r.meta.totalPages));
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setResult(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, resource, page, search, status, refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  async function logout() {
    setSigningOut(true);
    setError("");
    try {
      await request("/auth/logout", { method: "POST" });
      setUser(null);
      setResult(null);
      setSessionError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSigningOut(false);
    }
  }
  if (checking)
    return (
      <main className="entry">
        <div className="brand">
          bareblekk<span>®</span>
        </div>
        <p role="status">Checking your session…</p>
      </main>
    );
  if (!user)
    return (
      <Login
        initialError={sessionError}
        onLogin={(u) => {
          setUser(u);
          setSessionError("");
          setRefresh((x) => x + 1);
        }}
      />
    );
  const config = resources[resource];
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="/admin/">
          bareblekk<span>®</span>
        </a>
        <p className="workspace-label">CATALOG ADMINISTRATION</p>
        <nav aria-label="Catalog sections">
          {(Object.keys(resources) as Resource[]).map((key) => (
            <a
              href={"#" + key}
              key={key}
              aria-current={key === resource ? "page" : undefined}
            >
              <span aria-hidden="true">{resources[key].icon}</span>
              {resources[key].label}
              {key === resource && (
                <span className="nav-dot" aria-hidden="true">
                  ●
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">BUILT FOR YOUR CATALOG</span>
          <p>
            Every detail makes
            <br />
            the right printer easier to find.
          </p>
        </div>
        <div className="account">
          <span className="avatar" aria-hidden="true">
            {user.name?.slice(0, 1).toUpperCase() || "B"}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role.toLowerCase()}</span>
          </div>
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={logout}
            disabled={signingOut}
          >
            ↪
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span>
            Workspace <span className="divider">/</span>{" "}
            <strong>{config.label}</strong>
          </span>
          <div className="topbar-actions">
            <span className="workspace-chip">Printer catalog</span>
            <button
              className="mobile-logout"
              onClick={logout}
              disabled={signingOut}
            >
              Sign out
            </button>
          </div>
        </header>
        <main id="main" className="main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CATALOG MANAGEMENT</p>
              <h1>
                {config.label}
                <span className="count">
                  {loading ? "…" : (result?.meta.total ?? "—")}
                </span>
              </h1>
              <p className="muted">{config.description}</p>
            </div>
            {canEdit && (
              <button className="primary" onClick={() => setEditor({})}>
                <span aria-hidden="true">＋</span> Add {config.singular}
              </button>
            )}
          </div>
          {user.role === "VIEWER" && (
            <p className="notice">
              Your account has read-only access. You can inspect records but
              cannot change them.
            </p>
          )}
          {toast && (
            <div className="notice success" role="status">
              {toast}
            </div>
          )}
          <section className="table-card" aria-label={config.label}>
            <div className="table-toolbar">
              {resource !== "attributes" && resource !== "downloads" ? (
                <label className="search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    ref={searchRef}
                    aria-label={"Search " + config.label.toLowerCase()}
                    placeholder={"Search " + config.label.toLowerCase() + "…"}
                    value={query}
                    maxLength={120}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              ) : (
                <strong>{config.label}</strong>
              )}
              <div className="toolbar-actions">
                {resource !== "attributes" && (
                  <select
                    aria-label="Filter by status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All statuses</option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setRefresh((x) => x + 1)}
                  disabled={loading}
                >
                  ↻ <span>Refresh</span>
                </button>
              </div>
            </div>
            {error && <Notice message={error} />}
            <div className="table-scroll" aria-busy={loading}>
              <table>
                <thead>
                  <tr>
                    <th>
                      {resource === "downloads"
                        ? "Document"
                        : resource === "products"
                          ? "Product / model"
                          : "Name"}
                    </th>
                    <th>
                      {resource === "products"
                        ? "SKU"
                        : resource === "attributes"
                          ? "Type"
                          : resource === "downloads"
                            ? "Type"
                            : "Slug"}
                    </th>
                    <th>Status</th>
                    <th>
                      {resource === "products"
                        ? "Availability"
                        : resource === "categories"
                          ? "Catalog visibility"
                          : "Order"}
                    </th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!loading &&
                    result?.data.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <button
                            className="record-name"
                            onClick={() => setEditor({ id: row.id })}
                          >
                            <span className="record-symbol" aria-hidden="true">
                              {config.icon}
                            </span>
                            <span>
                              <strong>{row.name || row.title}</strong>
                              {resource === "products" && (
                                <small>
                                  {row.lifecycle === "DISCONTINUED"
                                    ? "Discontinued model"
                                    : row.shortDescription ||
                                      "No short description yet"}
                                </small>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="mono muted">
                          {resource === "products"
                            ? row.sku || "—"
                            : resource === "attributes" ||
                                resource === "downloads"
                              ? row.type
                              : row.slug}
                        </td>
                        <td>
                          <Badge row={row} resource={resource} />
                        </td>
                        <td className="muted">
                          {resource === "products"
                            ? row.stockQuantity == null
                              ? "Not specified"
                              : row.stockQuantity === 0
                                ? "Out of stock"
                                : `${row.stockQuantity} in stock`
                            : resource === "categories"
                              ? row.isVisible
                                ? "Visible"
                                : "Not visible"
                              : (row.sortOrder ?? 0)}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setEditor({ id: row.id })}
                          >
                            {canEdit ? "Edit" : "View"}{" "}
                            <span aria-hidden="true">↗</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {loading ? (
                <div className="empty" role="status">
                  Loading {config.label.toLowerCase()}…
                </div>
              ) : !error && result?.data.length === 0 ? (
                <div className="empty">
                  <span className="empty-icon" aria-hidden="true">
                    {config.icon}
                  </span>
                  <h2>
                    {search || status
                      ? "No matching records"
                      : `No ${config.label.toLowerCase()} yet`}
                  </h2>
                  <p>
                    {search || status
                      ? "Try another search or clear the filters."
                      : `Add your first ${config.singular} to start building the catalog.`}
                  </p>
                  {search || status ? (
                    <button
                      onClick={() => {
                        setQuery("");
                        setSearch("");
                        setStatus("");
                        setPage(1);
                      }}
                    >
                      Clear filters
                    </button>
                  ) : (
                    canEdit && (
                      <button className="primary" onClick={() => setEditor({})}>
                        Add {config.singular}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </div>
            <footer className="pagination">
              <span>
                {result && result.meta.total > 0
                  ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, result.meta.total)} of ${result.meta.total}`
                  : "0 records"}
              </span>
              <div>
                <button
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Previous
                </button>
                <span>
                  Page {page} of {Math.max(1, result?.meta.totalPages ?? 1)}
                </span>
                <button
                  disabled={
                    loading || !result || page >= result.meta.totalPages
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            </footer>
          </section>
          <p className="page-note">
            Changes are saved to your Bareblekk catalog. Archived records can be
            restored from their editor.
          </p>
        </main>
      </div>
      {editor && (
        <EntityEditor
          resource={resource}
          id={editor.id}
          canEdit={canEdit}
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setRefresh((x) => x + 1);
            setToast(message);
          }}
        />
      )}
    </div>
  );
}
