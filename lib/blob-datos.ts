import { del, list, put } from "@vercel/blob";
import { desencriptarTexto, encriptarTexto } from "@/lib/cifrar-json";

const SENSIBLES = new Set(["usuarios.json", "pedidos.json"]);

export function blobActivo() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function rutaDato(nombre: string) {
  return `datos/${nombre}`;
}

export async function leerDatoBlob(nombre: string) {
  if (!blobActivo()) return null;
  try {
    const { blobs } = await list({ prefix: rutaDato(nombre), limit: 20 });
    const archivo = blobs.find((b) => b.pathname === rutaDato(nombre));
    if (!archivo) return null;
    const res = await fetch(archivo.url, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = await res.text();
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
      access: "public",
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
  const blob = await put(`fotos/${carpeta}/${nombre}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: mime,
  });
  return blob.url;
}

export async function borrarFotoBlob(url: string) {
  if (!blobActivo()) return;
  await del(url).catch((error) => {
    console.error("[blob] borrar foto", error);
  });
}

export function esUrlBlob(url: string) {
  return /vercel-storage\.com/i.test(url);
}
