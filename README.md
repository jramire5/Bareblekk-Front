# Bareblekk catalog administration

El sitio utiliza español como idioma único (`lang="es"`). Los textos de interfaz y las nuevas pantallas deben escribirse en español; los identificadores y valores internos de la API se conservan sin traducir.

Astro + React frontend for the sibling `../Bareblekk GPT` API. The public landing page is available at `/` and the administrator workspace at `/admin/`.

## Landing pública

La portada presenta equipos de impresión, aplicaciones, respaldo institucional y contacto, con Poppins local (Regular, Medium y Semibold), los colores oficiales y el logo original. Incluye navegación móvil, enlaces internos y selección de la aplicación de interés desde cada tarjeta.

Esta primera entrega es una landing estática: las imágenes ilustran tecnologías y no representan productos publicados ni existencias en tiempo real. La integración del catálogo público con la API queda para una etapa posterior. El formulario prepara un correo a `info@bareblekk.com`, tomado de la guía de marca; la persona revisa y envía la consulta desde su aplicación de correo. No almacena datos ni simula una confirmación de envío.

Las fuentes se sirven desde `public/fonts/`, con su licencia OFL. La procedencia de las fotografías se documenta en `public/images/landing/SOURCES.md`.

## Run locally

Use Node.js 22.12 or later and pnpm.

```sh
pnpm install
pnpm astro dev --background
```

Open **http://localhost:5173/** for the landing or **http://localhost:5173/admin/** for administration. Astro proxies `/api` to `http://127.0.0.1:8787`, keeping session cookies on the frontend origin. Port 5173 matches the backend's existing origin allowlist. The server refuses to silently select another port. The landing works without the backend.

Start the backend separately when you want to use real catalog data:

```powershell
cd '../Bareblekk GPT'
.\npm-local.cmd run dev
```

Use the existing backend account. Local administrator credentials are stored in the backend's ignored `.local/admin-access.json`; they are never copied into this project or included in the client bundle. User creation and password recovery are not currently exposed by the backend.

```sh
pnpm astro dev status
pnpm astro dev logs
pnpm astro dev stop
```

If an older preview is running on port 4321, stop it and start it again to use the current configuration.

## What the workspace supports

- Session login/logout and read-only access for VIEWER accounts; ADMIN and EDITOR accounts can make changes.
- Products, categories, brands, product lines, applications, tags, technical attributes, and PDF documents.
- Create and edit records, publish/unpublish, archive, and restore. The API archives catalog records instead of permanently deleting them. Attributes use activation/deactivation.
- Server-side search and status filters where supported, with paginated lists. Relationship selectors fetch all pages.
- Product brand and line selection, descriptions, lifecycle, featured flag, SKU, and SEO metadata.
- Product category/application/tag assignments, stock quantity, and typed technical specifications.
- Image uploads, alternative text, main/gallery roles, ordering, and removal; YouTube/Vimeo video creation, editing, ordering, and removal.
- PDF uploads, metadata, product or product-line ownership, and publication states.
- Backend validation feedback, unsaved-change prompts, and optimistic concurrency through quoted `If-Match` versions. A stale edit is never automatically retried over someone else's changes.

Products require a short description, a visible category, and a main image with alternative text before publication. A category is visible only if it and every ancestor are published. Published slugs remain locked even after unpublishing. Restore archived records to draft before publishing them again.

Images accept JPEG, PNG, and WebP up to 10 MB. Documents accept PDF up to 25 MB. Use the backend's normal Wrangler dev command for local file storage; its `dev:node` fallback does not provide file storage.

## Verification

```sh
pnpm check
pnpm test
pnpm build
```

Tests are isolated. They mock API calls and exercise React forms, session handling, role restrictions, request bodies, concurrency failures, pagination, category hierarchy, and specification conversion. They do not connect to the backend or modify catalog data. Live-service mutation testing is intentionally deferred.

With the background dev server running, `pnpm test:browser` verifies actual React hydration in a headless browser. Every API request is intercepted with test responses, so these tests also never contact the backend. Windows uses installed Microsoft Edge; other platforms use Playwright Chromium (`pnpm exec playwright install chromium`). Run this after `pnpm build` while the dev server stays alive to check that build-time dependency optimization cannot break the preview.

Astro commands use separate Vite cache directories (`node_modules/.vite/astro-dev`, `astro-build`, and `astro-sync`). This prevents a concurrent build or check from replacing the dev server's React JSX runtime with its production version.

## Configuration and deployment

`.env.example` documents the API base. By default the browser uses `/api/v1`. To change the development proxy target, set `BAREBLEKK_API_ORIGIN` in the shell before starting Astro. `PUBLIC_API_BASE_URL` is a public, build-time variable and must never contain credentials.

The production build is static. A production host must route `/api` to the Bareblekk backend, or the frontend must be built with the address of a same-site HTTPS API. Configure the frontend origin in the backend's `ALLOWED_ORIGINS` and use secure session cookies in production. The Vite development proxy is not part of `dist` or `astro preview`.

The application has been kept local; no website or backend has been deployed.

The sibling backend's Prisma generator was set to `runtime = "cloudflare"` so its generated client can run under Wrangler. This changes generated client code only, not the database schema or stored data. After changing generator settings, run `npm-local.cmd run db:generate` in the backend.
