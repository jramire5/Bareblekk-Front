const fieldLabels: Record<string, string> = {
  name: "Nombre", title: "Título", email: "Correo electrónico", password: "Contraseña",
  slug: "Identificador de URL", code: "Código", type: "Tipo", unit: "Unidad",
  description: "Descripción", shortDescription: "Descripción breve", sortOrder: "Orden",
  brandId: "Marca", productLineId: "Línea de productos", productId: "Producto",
  parentId: "Categoría superior", allowedValues: "Valores permitidos", status: "Estado",
  lifecycle: "Ciclo de vida", isFeatured: "Producto destacado", seoTitle: "Título SEO",
  seoDescription: "Descripción SEO", quantity: "Cantidad", altText: "Texto alternativo",
  role: "Función", provider: "Proveedor", url: "URL", file: "Archivo", ids: "Selección",
  items: "Elementos", attributeId: "Atributo", value: "Valor", groupName: "Grupo",
  active: "Activo", filterable: "Usar como filtro", sku: "SKU",
};

export function validationDetail(detail: { field: string; message: string }) {
  const field = detail.field.split(".").map(part => fieldLabels[part] ?? (/^\d+$/.test(part) ? String(Number(part) + 1) : part)).join(" · ");
  let message = detail.message;
  if (/^Too small:/.test(message)) {
    const limit = message.match(/>=(\d+(?:\.\d+)?)/)?.[1];
    message = limit ? /string/.test(message) ? `Ingresá al menos ${limit} caracteres.` : /array/.test(message) ? `Seleccioná al menos ${limit} elementos.` : `El valor debe ser mayor o igual a ${limit}.` : "El valor es demasiado pequeño.";
  } else if (/^Too big:/.test(message)) {
    const limit = message.match(/<=(\d+(?:\.\d+)?)/)?.[1];
    message = limit ? /string/.test(message) ? `Usá como máximo ${limit} caracteres.` : /array/.test(message) ? `Seleccioná como máximo ${limit} elementos.` : `El valor debe ser menor o igual a ${limit}.` : "El valor es demasiado grande.";
  } else if (/^Invalid (input|type):/.test(message)) {
    message = /received undefined/.test(message) ? "Este campo es obligatorio." : /expected number/.test(message) ? "Ingresá un número válido." : /expected int/.test(message) ? "Ingresá un número entero, sin decimales." : /expected string/.test(message) ? "Ingresá un texto." : /expected boolean/.test(message) ? "Seleccioná Sí o No." : "El valor no tiene el tipo o formato esperado.";
  } else if (/^Invalid option:/.test(message)) {
    message = "Elegí una opción válida.";
  } else if (/^Invalid/.test(message)) {
    message = detail.field === "slug" ? "Usá solo letras minúsculas, números y guiones entre palabras, sin espacios ni acentos." : /email/.test(message) ? "Ingresá un correo electrónico válido, por ejemplo nombre@empresa.com." : /URL|url/.test(message) ? "Ingresá una dirección completa que empiece con https:// o http://." : /UUID|uuid/.test(message) ? "La referencia seleccionada no es válida. Volvé a seleccionar el registro." : "El formato no es válido.";
  } else if (message === "Required") {
    message = "Este campo es obligatorio.";
  } else if (/^Unrecognized key/.test(message)) {
    message = "La solicitud contiene campos no admitidos.";
  }
  return `${field}: ${message}`;
}

const errorGuidance: Record<string, string> = {
  "Completá la descripción breve.": "Falta la descripción breve. Completala en Información y guardá los cambios antes de publicar.",
  "Completá nombre y slug.": "Falta el nombre o el identificador de URL. Completalos en Información y guardá los cambios antes de publicar.",
  "Elegí al menos una categoría visible.": "El producto no tiene una categoría visible. Asigná una en Categorías y guardá la selección. Para ser visible, la categoría y todas sus categorías superiores deben estar publicadas.",
  "Agregá una imagen principal con texto alternativo.": "Falta una imagen principal con texto alternativo. En Imágenes, subí o elegí una imagen, asignale la función Imagen principal, completá el texto alternativo y guardá los detalles.",
  "Marca inválida.": "La marca seleccionada no existe o está archivada para nuevas asociaciones. Elegí una marca habilitada en Información.",
  "Una asociación es inexistente o está archivada.": "Uno de los registros seleccionados ya no existe o está archivado. Revisá la selección y quitá o reemplazá ese registro antes de guardar.",
};
export function errorMessage(code: string, message: string) {
  if (errorGuidance[message]) return errorGuidance[message];
  const guidance: Record<string, string> = {
    FILES_NOT_CONFIGURED: "El almacenamiento de archivos no está configurado. Pedí al responsable del sistema que lo habilite antes de subir o descargar archivos.",
    FILE_TOO_LARGE: "El archivo supera el tamaño permitido: hasta 10 MB para imágenes y 25 MB para documentos PDF. Reducí su tamaño y volvé a subirlo.",
    UNSUPPORTED_FILE: "El formato real del archivo no coincide con los formatos permitidos. Usá JPEG, PNG o WebP para imágenes y PDF para documentos; cambiar la extensión no convierte el archivo.",
    DUPLICATE: "El identificador único ya está en uso. Revisá el identificador de URL, código u otro campo único del registro y elegí uno que no esté utilizado.",
    FORBIDDEN: "Tu cuenta no tiene permiso para esta acción. Pedí al administrador que revise tus permisos.",
  };
  return guidance[code] ?? message;
}
