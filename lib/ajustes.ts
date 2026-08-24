import { promises as fs } from "fs";
import path from "path";
import type { AjustesPrecios } from "@/types/ajustes";

const archivo = path.join(process.cwd(), "data", "ajustes.json");

const vacio: AjustesPrecios = {
  descuentoClienteGenerico: 10,
  ajustePorSeccion: {},
  descuentoClientePorSeccion: {},
};

function porcentaje(valor: unknown, max = 90) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

function mapaPorcentajes(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [clave, valor] of Object.entries(raw as Record<string, unknown>)) {
    const n = porcentaje(valor);
    if (clave && n !== null) out[clave] = n;
  }
  return out;
}

export async function leerAjustes(): Promise<AjustesPrecios> {
  try {
    const raw = await fs.readFile(archivo, "utf8");
    const parsed = JSON.parse(raw) as Partial<AjustesPrecios>;
    const descuento =
      porcentaje(parsed.descuentoClienteGenerico) ?? 10;
    return {
      descuentoClienteGenerico: descuento,
      ajustePorSeccion:
        parsed.ajustePorSeccion && typeof parsed.ajustePorSeccion === "object"
          ? parsed.ajustePorSeccion
          : {},
      descuentoClientePorSeccion: mapaPorcentajes(
        parsed.descuentoClientePorSeccion,
      ),
    };
  } catch {
    return { ...vacio, ajustePorSeccion: {}, descuentoClientePorSeccion: {} };
  }
}

export async function guardarAjustes(ajustes: AjustesPrecios) {
  await fs.mkdir(path.dirname(archivo), { recursive: true });
  await fs.writeFile(archivo, JSON.stringify(ajustes, null, 2), "utf8");
}
