"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { reemplazarVentasRespaldo } from "@/lib/caja";
import { reemplazarClientesRespaldo } from "@/lib/cuentas";
import { guardarFotoSitio } from "@/lib/fotos-sitio";
import { guardarProductos } from "@/lib/productos";
import {
  parsearExcelRespaldo,
  parsearZipRespaldo,
  type DatosRespaldo,
} from "@/lib/respaldo";
import { getSesion } from "@/lib/sesion";

export type EstadoRespaldo = { error?: string; ok?: string } | null;

function mimeDeNombre(nombre: string) {
  const ext = nombre.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function mimeDeFoto(nombre: string, buffer: Buffer) {
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return mimeDeNombre(nombre);
}

async function enParalelo<T>(items: readonly T[], limite: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  const trabajadores = Math.max(1, Math.min(limite, items.length || 1));
  await Promise.all(
    Array.from({ length: trabajadores }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await fn(item);
      }
    }),
  );
}

async function aplicarRespaldo(datos: DatosRespaldo, modo: "reemplazar" | "fusionar") {
  const partes: string[] = [];

  if (datos.productos.length) {
    if (modo === "reemplazar") {
      await guardarProductos(datos.productos);
      partes.push(`${datos.productos.length} productos`);
    } else {
      const { leerProductos } = await import("@/lib/productos");
      const actuales = await leerProductos();
      const porCodigo = new Map(actuales.map((p) => [p.codigo.toLowerCase(), p]));
      for (const p of datos.productos) {
        porCodigo.set(p.codigo.toLowerCase(), {
          ...porCodigo.get(p.codigo.toLowerCase()),
          ...p,
        });
      }
      const merged = [...porCodigo.values()];
      await guardarProductos(merged);
      partes.push(`${datos.productos.length} productos (fusionados → ${merged.length})`);
    }
  }

  if (datos.clientes.length) {
    if (modo === "reemplazar") {
      await reemplazarClientesRespaldo(datos.clientes);
      partes.push(`${datos.clientes.length} clientes`);
    } else {
      const { leerCuentas } = await import("@/lib/cuentas");
      const actuales = (await leerCuentas()).clientes;
      const porId = new Map(actuales.map((c) => [c.id, c]));
      const porEmail = new Map(
        actuales.map((c) => [c.email.trim().toLowerCase(), c]),
      );
      for (const c of datos.clientes) {
        const previo =
          porId.get(c.id) || porEmail.get(c.email.trim().toLowerCase());
        const final = previo ? { ...previo, ...c, id: previo.id } : c;
        porId.set(final.id, final);
        porEmail.set(final.email.trim().toLowerCase(), final);
      }
      await reemplazarClientesRespaldo([...porId.values()]);
      partes.push(`${datos.clientes.length} clientes (fusionados → ${porId.size})`);
    }
  }

  if (datos.ventas.length) {
    if (modo === "reemplazar") {
      await reemplazarVentasRespaldo(datos.ventas);
      partes.push(`${datos.ventas.length} ventas`);
    } else {
      const { leerVentasCaja } = await import("@/lib/caja");
      const actuales = await leerVentasCaja();
      const porId = new Map(actuales.map((v) => [v.id, v]));
      for (const v of datos.ventas) porId.set(v.id, v);
      await reemplazarVentasRespaldo([...porId.values()]);
      partes.push(`${datos.ventas.length} ventas (fusionadas → ${porId.size})`);
    }
  }

  let fotosOk = 0;
  await enParalelo(datos.fotos, 4, async (foto) => {
    if (!foto.buffer?.length) return;
    try {
      await guardarFotoSitio({
        carpeta: foto.carpeta,
        nombre: path.basename(foto.nombre),
        buffer: foto.buffer,
        mime: mimeDeFoto(foto.nombre, foto.buffer),
      });
      fotosOk += 1;
    } catch (error) {
      console.error("[respaldo-foto]", foto.nombre, error);
    }
  });
  if (fotosOk) partes.push(`${fotosOk} fotos`);

  return partes;
}

export async function importarRespaldoCaja(
  _prev: EstadoRespaldo,
  formData: FormData,
): Promise<EstadoRespaldo> {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return { error: "Solo el administrador puede volcar un respaldo." };
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí un archivo Excel (.xlsx) o ZIP de respaldo." };
  }

  const nombre = archivo.name.toLowerCase();
  if (!nombre.endsWith(".xlsx") && !nombre.endsWith(".zip")) {
    return { error: "El archivo tiene que ser .xlsx o .zip." };
  }

  const modoRaw = String(formData.get("modo") || "fusionar");
  const modo = modoRaw === "reemplazar" ? "reemplazar" : "fusionar";

  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const datos = nombre.endsWith(".zip")
      ? await parsearZipRespaldo(buffer)
      : await parsearExcelRespaldo(buffer);

    if (
      !datos.productos.length &&
      !datos.clientes.length &&
      !datos.ventas.length &&
      !datos.fotos.length
    ) {
      return { error: "El archivo no tiene productos, clientes, ventas ni fotos." };
    }

    const partes = await aplicarRespaldo(datos, modo);
    revalidatePath("/", "layout");
    revalidatePath("/caja");
    revalidatePath("/catalogo");
    revalidatePath("/admin");

    return {
      ok: `Respaldo cargado (${modo}): ${partes.join(", ") || "sin cambios"}.`,
    };
  } catch (error) {
    console.error("[importar-respaldo]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo leer el respaldo.",
    };
  }
}
