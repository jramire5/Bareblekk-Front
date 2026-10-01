import { loadPublicProducts, mainImage, publicAssetUrl, type PublicProduct } from './public-catalog';

const availabilityLabels = {
  IN_STOCK: 'Disponible',
  OUT_OF_STOCK: 'Sin existencias',
  UNKNOWN: 'Consulte disponibilidad',
};
const technologyLabels: Record<string, string> = {
  ECO_SOLVENT: 'Ecosolvente', UV_LED: 'UV LED', SUBLIMATION: 'Sublimación', DTF: 'DTF', UV_DTF: 'UV DTF',
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function productImage(product: PublicProduct, hero = false) {
  const image = mainImage(product);
  const fallback = element('p', hero ? 'hero-image-fallback' : 'product-image-fallback', 'Imagen no disponible');
  if (!image) return fallback;
  const img = element('img', hero ? 'hero-printer' : 'product-image');
  img.src = publicAssetUrl(image.url);
  img.alt = image.altText || product.name;
  img.width = 800;
  img.height = 460;
  img.loading = hero ? 'eager' : 'lazy';
  if (hero) img.fetchPriority = 'high';
  img.addEventListener('error', () => img.replaceWith(fallback), { once: true });
  return img;
}

export function renderProductCard(product: PublicProduct, index: number) {
  const card = element('article', 'solution-card');
  card.dataset.productId = product.id;
  const visual = element('div', 'solution-image');
  visual.append(element('span', 'solution-number', `${String(index + 1).padStart(2, '0')} /`), productImage(product));
  const content = element('div', 'solution-content');
  content.append(element('p', 'card-eyebrow', product.categories.map(category => category.name).join(' · ') || product.brand.name));
  content.append(element('h3', '', product.name));
  const availability = product.lifecycle === 'DISCONTINUED'
    ? 'Equipo discontinuado'
    : availabilityLabels[product.availability] ?? availabilityLabels.UNKNOWN;
  content.append(element('p', 'product-availability', availability));
  if (product.shortDescription || product.description) {
    content.append(element('p', 'solution-description', product.shortDescription || product.description || ''));
  }
  const labels = [...new Set([...product.applications, ...product.tags].map(item => item.name))];
  if (labels.length) {
    const tags = element('ul', 'tags');
    tags.setAttribute('aria-label', 'Aplicaciones y etiquetas');
    tags.append(...labels.map(label => element('li', '', label)));
    content.append(tags);
  }
  if (product.specifications.length) {
    const details = element('details', 'product-details');
    details.append(element('summary', '', 'Especificaciones técnicas'));
    const list = element('dl', 'product-specifications');
    for (const spec of product.specifications) {
      const value = typeof spec.value === 'boolean' ? (spec.value ? 'Sí' : 'No')
        : spec.code === 'technology' ? technologyLabels[String(spec.value)] ?? String(spec.value) : String(spec.value);
      list.append(element('dt', '', spec.name), element('dd', '', `${value}${spec.unit ? ` ${spec.unit}` : ''}`));
    }
    details.append(list);
    content.append(details);
  }
  const downloads = element('ul', 'product-downloads');
  for (const download of product.downloads) {
    const url = publicAssetUrl(download.url);
    if (!url) continue;
    const item = element('li', '');
    const link = element('a', 'text-link', download.title);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    downloads.append(item);
  }
  if (downloads.childElementCount) content.append(downloads);
  const inquiry = element('a', 'solution-link', 'Consultar equipo');
  inquiry.href = '#contacto';
  inquiry.dataset.interest = product.name;
  inquiry.setAttribute('aria-label', `Consultar por ${product.name}`);
  const arrow = element('span', '', '→');
  arrow.setAttribute('aria-hidden', 'true');
  inquiry.append(arrow);
  content.append(inquiry);
  card.append(visual, content);
  return card;
}

export function mountLandingCatalog() {
  const grid = document.querySelector<HTMLDivElement>('#public-products');
  const status = document.querySelector<HTMLParagraphElement>('#catalog-status');
  const retry = document.querySelector<HTMLButtonElement>('#catalog-retry');
  const hero = document.querySelector<HTMLDivElement>('#hero-product');
  const interests = document.querySelector<HTMLOptGroupElement>('#product-interests');
  const select = document.querySelector<HTMLSelectElement>('#interest');
  if (!grid || !status || !retry || !hero || !interests || !select) return () => {};

  let controller: AbortController | undefined;
  let disposed = false;

  function renderHero(products: PublicProduct[], fallback: string) {
    const product = products.find(item => item.isFeatured && mainImage(item))
      ?? products.find(item => mainImage(item));
    if (!product) {
      hero!.replaceChildren(element('p', 'hero-image-fallback', fallback));
      return;
    }
    const caption = element('div', 'hero-caption');
    const copy = element('div', '');
    copy.append(element('span', 'caption-label', product.categories.map(category => category.name).join(' · ') || product.brand.name));
    copy.append(element('p', '', product.name));
    const link = element('a', 'circle-link', '→');
    link.href = '#catalogo';
    link.setAttribute('aria-label', 'Explorar equipos publicados');
    caption.append(copy, link);
    hero!.replaceChildren(productImage(product, true), caption);
  }

  function renderInterests(products: PublicProduct[]) {
    const previous = select!.value;
    interests!.replaceChildren(...products.map(product => {
      const option = element('option', '', product.name);
      option.value = product.name;
      return option;
    }));
    if ([...select!.options].some(option => option.value === previous)) select!.value = previous;
    else select!.value = 'Asesoramiento general';
  }

  async function refresh() {
    if (disposed || controller) return;
    controller = new AbortController();
    const timeout = window.setTimeout(() => controller?.abort(), 15000);
    retry!.disabled = true;
    grid!.setAttribute('aria-busy', 'true');
    try {
      const products = await loadPublicProducts(controller.signal);
      if (disposed) return;
      grid!.replaceChildren(...products.map(renderProductCard));
      status!.textContent = products.length ? '' : 'No hay equipos publicados por el momento. Consulte a nuestro equipo para recibir asesoramiento.';
      status!.hidden = products.length > 0;
      retry!.hidden = true;
      renderHero(products, 'Conversemos sobre su próxima impresión.');
      renderInterests(products);
    } catch {
      if (disposed) return;
      // Clear outdated prices/availability or unpublished records after a failed refresh.
      grid!.replaceChildren();
      status!.textContent = 'No pudimos cargar los equipos. Intente nuevamente o contáctenos para recibir asesoramiento.';
      status!.hidden = false;
      retry!.hidden = false;
      renderHero([], 'Consulte las soluciones de impresión con nuestro equipo.');
      renderInterests([]);
    } finally {
      window.clearTimeout(timeout);
      controller = undefined;
      retry!.disabled = false;
      grid!.setAttribute('aria-busy', 'false');
    }
  }

  const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
  retry.addEventListener('click', refresh);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  const interval = window.setInterval(onVisible, 60000);
  void refresh();
  return () => {
    disposed = true;
    controller?.abort();
    window.clearInterval(interval);
    retry.removeEventListener('click', refresh);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}
