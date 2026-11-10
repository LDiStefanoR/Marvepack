import { randomUUID } from "crypto";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { esPagoMixto, ID_PAGO_MIXTO } from "@/lib/pago-mixto";

export type MedioPago = {
  id: string;
  nombre: string;
  /** Si es efectivo, al cobrar se escribe con cuánto paga el cliente y se calcula el vuelto. */
  efectivo: boolean;
};

const MIXTO: MedioPago = { id: ID_PAGO_MIXTO, nombre: "Pago mixto", efectivo: false };

const SEMILLA: MedioPago[] = [
  { id: "contado", nombre: "Contado", efectivo: true },
  { id: "tarjeta", nombre: "Tarjeta", efectivo: false },
  { ...MIXTO },
];

function conMixtoFijo(lista: MedioPago[]): { lista: MedioPago[]; cambio: boolean } {
  let cambio = false;
  const out: MedioPago[] = [];
  let hayMixto = false;
  for (const medio of lista) {
    if (esPagoMixto(medio.id) || esPagoMixto(medio.nombre)) {
      if (!hayMixto) {
        out.push({ ...MIXTO });
        hayMixto = true;
        if (medio.id !== MIXTO.id || medio.nombre !== MIXTO.nombre) cambio = true;
      } else {
        cambio = true;
      }
      continue;
    }
    out.push(medio);
  }
  if (!hayMixto) {
    out.push({ ...MIXTO });
    cambio = true;
  }
  return { lista: out, cambio };
}

export async function leerMediosPago(): Promise<MedioPago[]> {
  const crudo = await leerJsonData<MedioPago[]>("medios-pago.json", SEMILLA);
  const limpia = (Array.isArray(crudo) ? crudo : []).filter(
    (m) => m && typeof m.nombre === "string" && m.nombre.trim().length > 0,
  );
  const base = limpia.length === 0 ? SEMILLA.map((m) => ({ ...m })) : limpia;
  const { lista, cambio } = conMixtoFijo(base);
  if (!lista.some((m) => m.efectivo)) lista[0] = { ...lista[0], efectivo: true };
  if (cambio) await escribirJsonData("medios-pago.json", lista);
  return lista;
}

export async function guardarMedioPago(datos: { nombre: string; efectivo: boolean }) {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { error: "Ingresá el nombre del medio de pago." as const };
  if (esPagoMixto(nombre)) {
    return { error: "Pago mixto ya está en la caja y no se carga de nuevo." as const };
  }
  const lista = await leerMediosPago();
  if (lista.some((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { error: "Ya hay un medio de pago con ese nombre." as const };
  }
  const medio: MedioPago = { id: randomUUID(), nombre, efectivo: datos.efectivo };
  const siguiente = datos.efectivo ? lista.map((m) => ({ ...m, efectivo: false })) : [...lista];
  siguiente.push(medio);
  if (!siguiente.some((m) => m.efectivo)) medio.efectivo = true;
  await escribirJsonData("medios-pago.json", siguiente);
  return { ok: true as const, nombre };
}

export async function quitarMedioPago(id: string) {
  const lista = await leerMediosPago();
  const medio = lista.find((m) => m.id === id);
  if (!medio) return { error: "No encontramos ese medio de pago." as const };
  if (esPagoMixto(medio.id) || esPagoMixto(medio.nombre)) {
    return { error: "Pago mixto no se puede quitar: es parte efectivo y parte tarjeta." as const };
  }
  if (lista.length === 1) return { error: "Tiene que quedar al menos un medio de pago." as const };
  const siguiente = lista.filter((m) => m.id !== id);
  if (!siguiente.some((m) => m.efectivo)) siguiente[0] = { ...siguiente[0], efectivo: true };
  await escribirJsonData("medios-pago.json", siguiente);
  return { ok: true as const, nombre: medio.nombre };
}
