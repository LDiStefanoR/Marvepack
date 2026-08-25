import { del, get, put } from "@vercel/blob";
import { desencriptarTexto, encriptarTexto } from "@/lib/cifrar-json";

const SENSIBLES = new Set(["usuarios.json", "pedidos.json"]);
const ACCESO = "private" as const;

function storeId() {
  return (
    process.env.marvegota_STORE_ID?.trim() ||
    process.env.BLOB_STORE_ID?.trim() ||
    ""
  );
}

function tokenBlob() {
  return (
    process.env.marvegota_READ_WRITE_TOKEN?.trim() ||
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    ""
  );
}

function authBlob() {
  return {
    ...(storeId() ? { storeId: storeId() } : {}),
    ...(tokenBlob() ? { token: tokenBlob() } : {}),
  };
}

function opcionesBlob() {
  return {
    access: ACCESO,
    ...authBlob(),
  };
}

export function blobActivo() {
  return Boolean(tokenBlob() || (process.env.VERCEL && storeId()));
}

export function rutaDato(nombre: string) {
  return `datos/${nombre}`;
}

export function rutaFoto(carpeta: string, nombre: string) {
  return `fotos/${carpeta}/${nombre}`;
}

export function urlFotoPublica(carpeta: string, nombre: string) {
  return `/api/media/${rutaFoto(carpeta, nombre)}`;
}

async function streamATexto(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return null;
  const buf = Buffer.from(await new Response(stream).arrayBuffer());
  return buf.toString("utf8");
}

export async function leerDatoBlob(nombre: string) {
  if (!blobActivo()) return null;
  try {
    const result = await get(rutaDato(nombre), {
      ...opcionesBlob(),
      useCache: false,
    });
    if (!result?.stream) return null;
    const raw = await streamATexto(result.stream);
    if (!raw) return null;
    return SENSIBLES.has(nombre) ? desencriptarTexto(raw) : raw;
  } catch (error) {
    console.error("[blob] lectura", nombre, error);
    return null;
  }
}

export async function guardarDatoBlob(nombre: string, json: string) {
  if (!blobActivo()) return false;
  const cuerpo = SENSIBLES.has(nombre) ? encriptarTexto(json) : json;
  try {
    await put(rutaDato(nombre), cuerpo, {
      ...opcionesBlob(),
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return true;
  } catch (error) {
    console.error("[blob] escritura", nombre, error);
    return false;
  }
}

export async function subirFotoBlob(
  carpeta: string,
  nombre: string,
  buffer: Buffer,
  mime: string,
) {
  if (!blobActivo()) return null;
  await put(rutaFoto(carpeta, nombre), buffer, {
    ...opcionesBlob(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: mime,
  });
  return urlFotoPublica(carpeta, nombre);
}

export async function borrarFotoBlob(url: string) {
  if (!blobActivo()) return;
  const pathname = url.startsWith("/api/media/")
    ? decodeURIComponent(url.slice("/api/media/".length))
    : url;
  await del(pathname, authBlob()).catch((error) => {
    console.error("[blob] borrar foto", error);
  });
}

export function esUrlBlob(url: string) {
  return /vercel-storage\.com/i.test(url) || url.startsWith("/api/media/");
}

export async function leerBlobBinario(pathname: string) {
  if (!blobActivo()) return null;
  const result = await get(pathname, {
    ...opcionesBlob(),
    useCache: true,
  });
  if (!result?.stream) return null;
  const body = Buffer.from(await new Response(result.stream).arrayBuffer());
  const type = result.blob.contentType || "application/octet-stream";
  return { body, type };
}
