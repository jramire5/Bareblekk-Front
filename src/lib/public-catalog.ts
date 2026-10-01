import { apiBase } from './api';

export type Classification = { id: string; name: string; slug: string };
export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  brand: { name: string; slug: string | null };
  line: { name: string; slug: string | null } | null;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  lifecycle: 'ACTIVE' | 'DISCONTINUED';
  isFeatured: boolean;
  categories: Classification[];
  applications: Classification[];
  tags: Classification[];
  images: { id: string; url: string; altText: string; role: 'MAIN' | 'GALLERY'; sortOrder: number }[];
  specifications: { code: string; name: string; type: string; value: string | number | boolean; unit: string | null; groupName: string | null }[];
  downloads: { id: string; title: string; type: string; url: string }[];
};

type PublicPage = {
  data: PublicProduct[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

/** The backend returns /api/v1 media paths even when hosted behind a custom API base. */
export function publicAssetUrl(path: string, base = apiBase): string {
  if (path.startsWith('/api/v1/')) return base.replace(/\/$/, '') + path.slice('/api/v1'.length);
  if (/^https?:\/\//i.test(path)) return path;
  return '';
}

export function mainImage(product: PublicProduct) {
  return [...product.images]
    .filter(image => image.role === 'MAIN' && publicAssetUrl(image.url))
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/** Anonymous, fresh public reads: never query admin or the unrestricted by-id route. */
export async function loadPublicProducts(signal: AbortSignal): Promise<PublicProduct[]> {
  const products = new Map<string, PublicProduct>();
  for (let page = 1; ; page++) {
    const response = await fetch(`${apiBase}/products?page=${page}&pageSize=100&sort=featured`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
    const result: PublicPage = await response.json();
    if (!Array.isArray(result?.data) || !result.meta ||
        result.meta.page !== page || !Number.isInteger(result.meta.totalPages) || result.meta.totalPages < 0 ||
        result.data.some(product => !product || typeof product.id !== 'string' || typeof product.name !== 'string' ||
          !Array.isArray(product.images) || !Array.isArray(product.categories) || !Array.isArray(product.applications) ||
          !Array.isArray(product.tags) || !Array.isArray(product.specifications) || !Array.isArray(product.downloads))) {
      throw new Error('El catálogo devolvió una respuesta inesperada.');
    }
    for (const product of result.data) products.set(product.id, product);
    if (page >= result.meta.totalPages) return [...products.values()];
    if (result.data.length === 0) throw new Error('No se pudo completar la carga del catálogo.');
  }
}
