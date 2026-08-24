"use server";

import { revalidatePath } from "next/cache";
import { leerAjustes } from "@/lib/ajustes";
import { getSesion } from "@/lib/sesion";
import { guardarProductos, leerProductos } from "@/lib/productos";
import { borrarFotoSitioSiLibre, guardarFotoSitio } from "@/lib/fotos-sitio";
import { driveFotosActivo } from "@/lib/drive-fotos";
import { leerRubros } from "@/lib/rubros";

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type EstadoImagen = { error?: string; ok?: string } | null;

function revalidarCatalogo() {
  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/admin");
}

async function exigirAdmin() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return null;
  }
  return sesion;
}

function nombreArchivo(codigo: string, ext: string) {
  const limpio = codigo.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "prod";
  return `carga-${limpio}-${Date.now()}${ext}`;
}

function imagenesUsadas(
  productos: { imagen: string }[],
  rubros: { imagen?: string }[],
) {
  const usadas = productos.map((p) => p.imagen);
  for (const r of rubros) {
    if (r.imagen) usadas.push(r.imagen);
  }
  return usadas;
}

export async function subirImagenProducto(
  form: FormData,
): Promise<EstadoImagen> {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return { error: "Solo el administrador puede cambiar fotos." };
  }

  const productoId = String(form.get("productoId") ?? "");
  const aplicarMisma = String(form.get("aplicarMismaFoto") ?? "") === "1";
  const archivo = form.get("imagen");

  if (!productoId) return { error: "Falta el producto." };
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí una imagen de tu PC." };
  }
  if (archivo.size > MAX_BYTES) {
    return { error: "La imagen no puede pesar más de 5 MB." };
  }
  const ext = TIPOS[archivo.type];
  if (!ext) return { error: "Usá JPG, PNG o WebP." };

  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };

  const nombre = nombreArchivo(producto.codigo, ext);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const ruta = await guardarFotoSitio({
    carpeta: "imagenes-productos",
    nombre,
    buffer,
    mime: archivo.type,
  });
  const anterior = producto.imagen;
  let afectados = 0;
  for (const item of productos) {
    if (item.id === productoId || (aplicarMisma && item.imagen === anterior)) {
      item.imagen = ruta;
      afectados += 1;
    }
  }
  await guardarProductos(productos);
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  await borrarFotoSitioSiLibre(anterior, imagenesUsadas(productos, rubros));

  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/admin");

  if (afectados > 1) {
    return {
      ok: `Guardamos la foto y la aplicamos a ${afectados} productos que usaban la misma imagen.${driveFotosActivo() ? " También quedó en Drive." : ""}`,
    };
  }
  return {
    ok: `Listo, actualizamos la foto de este producto.${driveFotosActivo() ? " También quedó en Drive." : ""}`,
  };
}

export async function guardarPrecioProducto(
  form: FormData,
): Promise<EstadoImagen> {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return { error: "Solo el administrador puede cambiar precios." };
  }

  const productoId = String(form.get("productoId") ?? "");
  const bruto = Number(String(form.get("precio") ?? "").replace(/[^\d]/g, ""));
  if (!productoId) return { error: "Falta el producto." };
  if (!Number.isFinite(bruto) || bruto < 1) {
    return { error: "Ingresá un precio general válido." };
  }

  const ajustes = await leerAjustes();
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };

  const extra = ajustes.ajustePorSeccion[producto.seccion] ?? 0;
  const factor = 1 + extra / 100;
  producto.precio = factor === 0 ? Math.round(bruto) : Math.round(bruto / factor);
  await guardarProductos(productos);

  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  revalidatePath("/admin");

  return {
    ok: `Guardamos el precio general de ${producto.codigo}: $${Math.round(bruto).toLocaleString("es-AR")}.`,
  };
}

export async function guardarNombreProducto(
  form: FormData,
): Promise<EstadoImagen> {
  if (!(await exigirAdmin())) {
    return { error: "Solo el administrador puede cambiar productos." };
  }
  const productoId = String(form.get("productoId") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();
  if (!productoId) return { error: "Falta el producto." };
  if (nombre.length < 3) {
    return { error: "El nombre tiene que tener al menos 3 caracteres." };
  }
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };
  producto.nombre = nombre;
  await guardarProductos(productos);
  revalidarCatalogo();
  return { ok: `Actualizamos el nombre de ${producto.codigo}.` };
}

export async function eliminarProducto(
  form: FormData,
): Promise<EstadoImagen> {
  if (!(await exigirAdmin())) {
    return { error: "Solo el administrador puede eliminar productos." };
  }
  const productoId = String(form.get("productoId") ?? "");
  if (!productoId) return { error: "Falta el producto." };
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) return { error: "No encontramos ese producto." };
  const resto = productos.filter((p) => p.id !== productoId);
  await guardarProductos(resto);
  const rubros = await leerRubros(resto.map((p) => p.seccion));
  await borrarFotoSitioSiLibre(producto.imagen, imagenesUsadas(resto, rubros));
  revalidarCatalogo();
  return { ok: `Eliminamos ${producto.codigo} — ${producto.nombre}.` };
}

export async function crearProducto(form: FormData): Promise<EstadoImagen> {
  if (!(await exigirAdmin())) {
    return { error: "Solo el administrador puede crear productos." };
  }
  const nombre = String(form.get("nombre") ?? "").trim();
  const codigo = String(form.get("codigo") ?? "").trim();
  const seccion = String(form.get("seccion") ?? "").trim();
  const bruto = Number(String(form.get("precio") ?? "").replace(/[^\d]/g, ""));

  if (nombre.length < 3) {
    return { error: "Ingresá un nombre de al menos 3 caracteres." };
  }
  if (!codigo) return { error: "Ingresá un código." };
  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));
  if (!rubros.some((r) => r.clave === seccion)) {
    return { error: "Elegí un rubro válido." };
  }
  if (!Number.isFinite(bruto) || bruto < 1) {
    return { error: "Ingresá un precio general válido." };
  }

  if (
    productos.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())
  ) {
    return { error: "Ya hay un producto con ese código." };
  }

  const ajustes = await leerAjustes();
  const extra = ajustes.ajustePorSeccion[seccion] ?? 0;
  const factor = 1 + extra / 100;
  const precio =
    factor === 0 ? Math.round(bruto) : Math.round(bruto / factor);

  const delRubro = productos.find((p) => p.seccion === seccion);
  const imagen =
    delRubro?.imagen ?? "/recursos/imagenes-productos/bolsa-cierre.jpg";

  const idBase = `mp-${codigo.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || Date.now()}`;
  let id = idBase;
  let n = 2;
  while (productos.some((p) => p.id === id)) {
    id = `${idBase}-${n}`;
    n += 1;
  }

  productos.unshift({
    id,
    codigo,
    nombre,
    seccion,
    precio,
    imagen,
    descripcion:
      "Consultanos medidas, cantidades y disponibilidad por WhatsApp.",
    precioMayorista: Math.round(precio * 0.9),
  });
  await guardarProductos(productos);
  revalidarCatalogo();
  return { ok: `Creamos ${codigo}. Ya está en el catálogo.` };
}
