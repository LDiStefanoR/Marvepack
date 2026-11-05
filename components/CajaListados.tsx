"use client";

import { useEffect, useMemo, useState } from "react";
import { CajaVentasDia } from "@/components/CajaVentasDia";
import { caja } from "@/components/caja-estilo";
import type { VentaCaja } from "@/lib/caja";
import type { ResumenCliente } from "@/types/cuenta";
import type { Pedido } from "@/types/pedido";
import {
  armarListado,
  filaTotales,
  filasSinTotal,
  tituloListado,
  type ComprobanteListado,
  type DeudaListado,
  type ProductoListado,
  type RetiroListado,
  type TipoListado,
} from "@/lib/listados";
import { diaArgentina } from "@/lib/venta-texto";

const GRUPOS: { titulo: string; tipos: { id: TipoListado; texto: string }[] }[] = [
  {
    titulo: "Productos",
    tipos: [
      { id: "stock-actual", texto: "Stock actual" },
      { id: "stock-minimo", texto: "Stock mínimo" },
      { id: "sin-stock", texto: "Sin stock" },
      { id: "mas-vendidos", texto: "Más vendidos" },
      { id: "menos-vendidos", texto: "Menos vendidos" },
    ],
  },
  {
    titulo: "Ventas",
    tipos: [
      { id: "ventas", texto: "Ventas" },
      { id: "ventas-comprobante", texto: "Por comprobante" },
      { id: "ventas-empleado", texto: "Por empleado" },
      { id: "ventas-producto", texto: "Por producto" },
      { id: "ventas-franja", texto: "Por franja horaria" },
      { id: "costo-ventas", texto: "Costo de productos" },
      { id: "ganancia", texto: "Ganancia" },
    ],
  },
  {
    titulo: "Compras",
    tipos: [
      { id: "valor-stock", texto: "Valor de mercadería" },
      { id: "compras-proveedor", texto: "Recepciones" },
      { id: "salidas-caja", texto: "Salidas de caja" },
    ],
  },
  {
    titulo: "Clientes",
    tipos: [
      { id: "mejores-clientes", texto: "Mejores clientes" },
      { id: "mas-deudas", texto: "Más deudas" },
      { id: "morosidad", texto: "Alta morosidad" },
      { id: "deudas-mercaderia", texto: "Deuda de mercadería" },
    ],
  },
  {
    titulo: "Préstamos",
    tipos: [
      { id: "prestamos-cobrar", texto: "A cobrar" },
      { id: "prestamos-mora", texto: "En mora" },
      { id: "prestamos-lineas", texto: "Líneas de crédito" },
      { id: "prestamos-pedidos", texto: "Pedidos de crédito" },
    ],
  },
];

const CON_FECHAS = new Set<TipoListado>([
  "ventas",
  "ventas-comprobante",
  "ventas-empleado",
  "ventas-producto",
  "ventas-franja",
  "costo-ventas",
  "ganancia",
  "mas-vendidos",
  "menos-vendidos",
  "mejores-clientes",
  "compras-proveedor",
  "salidas-caja",
]);

export function CajaListados({
  productos,
  ventas,
  deudas,
  comprobantes,
  retiros,
  etiqueta,
  fichas,
  pedidos,
  escalas,
  pending,
  onAnular,
  onVolver,
}: {
  productos: ProductoListado[];
  ventas: VentaCaja[];
  deudas: DeudaListado[];
  comprobantes: ComprobanteListado[];
  retiros: RetiroListado[];
  etiqueta: Record<string, string>;
  fichas: ResumenCliente[];
  pedidos: Pedido[];
  escalas: { moraCredito?: readonly number[]; moraCuenta?: readonly number[] };
  pending: boolean;
  onAnular: (id: string) => void;
  onVolver: () => void;
}) {
  const hoy = diaArgentina();
  const [tipo, setTipo] = useState<TipoListado>("ventas");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [q, setQ] = useState("");
  const [fuera, setFuera] = useState<number[]>([]);
  const usaFechas = CON_FECHAS.has(tipo);
  const filtro = {
    desde: usaFechas ? desde : "",
    hasta: usaFechas ? hasta : "",
    q,
  };
  const tabla = useMemo(
    () =>
      armarListado(
        tipo,
        { productos, ventas, deudas, etiqueta, comprobantes, retiros, fichas, pedidos, escalas },
        filtro,
      ),
    [tipo, productos, ventas, deudas, etiqueta, comprobantes, retiros, fichas, pedidos, escalas, filtro.desde, filtro.hasta, filtro.q],
  );
  const datos = useMemo(() => filasSinTotal(tabla.filas), [tabla.filas]);
  const ocultos = useMemo(() => new Set(fuera), [fuera]);
  const elegidas = useMemo(
    () => datos.filter((_, indice) => !ocultos.has(indice)),
    [datos, ocultos],
  );
  const totales = useMemo(
    () => filaTotales(tabla.columnas, elegidas, datos),
    [tabla.columnas, elegidas, datos],
  );
  useEffect(() => {
    setFuera([]);
  }, [tipo, desde, hasta, q]);
  const ventasOrdenadas = useMemo(() => {
    if (tipo !== "ventas") return [];
    const porNumero = new Map(ventas.map((venta) => [venta.numero, venta]));
    return datos.flatMap((fila) => {
      const numero = Number(String(fila[0] ?? "").replace(/[^\d]/g, ""));
      const venta = porNumero.get(numero);
      return venta ? [venta] : [];
    });
  }, [tipo, ventas, datos]);

  const params = new URLSearchParams({ tipo });
  if (filtro.desde) params.set("desde", filtro.desde);
  if (filtro.hasta) params.set("hasta", filtro.hasta);
  if (filtro.q) params.set("q", filtro.q);
  if (fuera.length > 0) params.set("fuera", fuera.join(","));

  return (
    <section className="px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={caja.kicker}>Informes</p>
          <h2 className={caja.titulo}>Listados</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/caja/listado?${params.toString()}`} className={caja.oscuro}>
            Bajar PDF
          </a>
          <a href={`/caja/listado?${params.toString()}&formato=xlsx`} className={caja.boton}>
            Bajar Excel
          </a>
          <button type="button" onClick={onVolver} className={caja.boton}>
            Volver
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo}>
            <p className={caja.kicker}>{grupo.titulo}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {grupo.tipos.map((opcion) => (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => setTipo(opcion.id)}
                  className={`min-h-9 min-w-0 rounded-xl border px-2.5 text-xs font-bold shadow-sm transition ${tipo === opcion.id ? caja.chipActivo : caja.chipIdle}`}
                >
                  {opcion.texto}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold">
          Buscar
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, código, número, cliente o empleado"
            className={`${caja.campo} mt-1 w-64`}
          />
        </label>
        {usaFechas && (
          <>
            <label className="text-sm font-bold">
              Desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${caja.campo} mt-1`} />
            </label>
            <label className="text-sm font-bold">
              Hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={`${caja.campo} mt-1`} />
            </label>
            <button
              type="button"
              className={caja.boton}
              onClick={() => {
                setDesde("");
                setHasta("");
              }}
            >
              Todo el historial
            </button>
            <button
              type="button"
              className={caja.boton}
              onClick={() => {
                setDesde(hoy);
                setHasta(hoy);
              }}
            >
              Solo hoy
            </button>
          </>
        )}
      </div>

      <h3 className="mt-4 font-display text-2xl font-bold">{tituloListado(tipo)}</h3>
      {tabla.nota && <p className="mt-1 max-w-4xl text-sm text-neutral-600">{tabla.nota}</p>}
      {tipo === "valor-stock" && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          Solo productos con unidades en stock. El costo es el último cargado. El valor de venta usa el precio de venta de cada producto.
        </p>
      )}
      {tipo === "compras-proveedor" && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          Cada fila es una factura cargada al recepcionar un pedido o al entrar mercadería sin pedido. El importe es el costo de lo que entró.
        </p>
      )}
      {tipo === "salidas-caja" && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          Retiros de efectivo registrados en la caja, por ejemplo pagos a proveedores o gastos.
        </p>
      )}
      {(tipo === "costo-ventas" || tipo === "ganancia") && (
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          El costo es el último cargado en cada producto. La ganancia es la venta menos ese costo. No incluye los listados de clientes.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-600">
        <span>
          {elegidas.length} de {datos.length} seleccionados
        </span>
        <button type="button" className={caja.boton} onClick={() => setFuera([])}>
          Marcar todos
        </button>
        <button type="button" className={caja.boton} onClick={() => setFuera(datos.map((_, indice) => indice))}>
          Desmarcar todos
        </button>
      </div>

      {tipo === "ventas" ? (
        <div className="mt-3">
          <CajaVentasDia
            ventas={ventasOrdenadas}
            pending={pending}
            onAnular={onAnular}
            titulo=""
            seleccionadas={datos.map((_, indice) => !ocultos.has(indice))}
            onSeleccionar={(indice, marcada) =>
              setFuera((actual) =>
                marcada ? actual.filter((item) => item !== indice) : [...new Set([...actual, indice])],
              )
            }
          />
          <p className="sticky bottom-0 border-t border-neutral-200 bg-neutral-50 px-3 py-3 text-sm font-black">
            Total de lo seleccionado: {totales.filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-100 text-xs uppercase">
              <tr>
                <th className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={datos.length > 0 && fuera.length === 0}
                    onChange={(e) => setFuera(e.target.checked ? [] : datos.map((_, indice) => indice))}
                    aria-label="Seleccionar todas las filas"
                  />
                </th>
                {tabla.columnas.map((columna) => (
                  <th key={columna} className="px-2 py-2">
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map((fila, indice) => {
                const marcada = !ocultos.has(indice);
                return (
                <tr key={`${tipo}-${indice}`} className={`border-t border-neutral-200 ${marcada ? "" : "opacity-40"}`}>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={(e) =>
                        setFuera((actual) =>
                          e.target.checked
                            ? actual.filter((item) => item !== indice)
                            : [...new Set([...actual, indice])],
                        )
                      }
                      aria-label={`Incluir fila ${indice + 1}`}
                    />
                  </td>
                  {fila.map((celda, i) => (
                    <td key={`${indice}-${i}`} className="px-2 py-2">
                      {celda}
                    </td>
                  ))}
                </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-neutral-50 text-sm font-black">
              <tr>
                <td className="px-2 py-3" />
                {totales.map((celda, indice) => (
                  <td key={`total-${indice}`} className="px-2 py-3">
                    {celda}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          {datos.length === 0 && (
            <p className="px-3 py-6 text-sm font-semibold text-neutral-500">No hay datos con ese filtro.</p>
          )}
        </div>
      )}
    </section>
  );
}
