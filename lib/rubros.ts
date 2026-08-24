import { promises as fs } from "fs";
import path from "path";
import {
  etiquetaRubro,
  RUBRO_RESERVADO,
  SECCION_LABEL,
  SECCIONES,
} from "@/lib/categorias";
import type { Rubro } from "@/types/rubro";

const archivo = path.join(process.cwd(), "data", "rubros.json");

function semilla(): Rubro[] {
  return SECCIONES.map((clave) => ({
    clave,
    etiqueta: SECCION_LABEL[clave] ?? clave,
  }));
}

function asegurarVarios(lista: Rubro[]) {
  const sinVarios = lista.filter((r) => r.clave !== RUBRO_RESERVADO);
  const varios = lista.find((r) => r.clave === RUBRO_RESERVADO);
  return [
    ...sinVarios,
    {
      clave: RUBRO_RESERVADO,
      etiqueta: varios?.etiqueta || "Varios",
      ...(varios?.imagen ? { imagen: varios.imagen } : {}),
    },
  ];
}

export async function leerRubros(clavesUsadas: string[] = []): Promise<Rubro[]> {
  let lista: Rubro[] = [];
  try {
    const raw = await fs.readFile(archivo, "utf8");
    const parsed = JSON.parse(raw) as Rubro[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      lista = parsed.filter((r) => r?.clave);
    }
  } catch {
    lista = [];
  }
  if (lista.length === 0) {
    lista = semilla();
    await guardarRubros(lista);
  }
  const map = new Map(lista.map((r) => [r.clave, r]));
  for (const clave of clavesUsadas) {
    if (clave && !map.has(clave)) {
      map.set(clave, { clave, etiqueta: etiquetaRubro(clave) });
    }
  }
  return asegurarVarios([...map.values()]);
}

export async function guardarRubros(rubros: Rubro[]) {
  const limpios = asegurarVarios(
    rubros
      .filter((r) => r.clave && r.etiqueta)
      .map((r) => ({
        clave: r.clave,
        etiqueta: r.etiqueta,
        ...(r.imagen ? { imagen: r.imagen } : {}),
      })),
  );
  await fs.mkdir(path.dirname(archivo), { recursive: true });
  await fs.writeFile(archivo, JSON.stringify(limpios, null, 2), "utf8");
}
