"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { solicitarCreditoCuenta, solicitarRecargaSaldo } from "@/app/acciones/pedidos";
import { formatoFecha, formatoPesos, nombreVitrina } from "@/lib/format";
import { interesDeTicket, numeroVisibleTicket, vencimientoDeTicket } from "@/lib/deuda";
import { moraCreditoDe, moraCuentaDe, politicaDeCliente, textoMoraSemanal } from "@/lib/politica-cliente";
import { simularCredito, tasasCredito, type PlazoCredito } from "@/lib/credito-cuotas";
import type { TicketDeuda } from "@/types/cuenta";

export type LineaCompraPerfil = {
  nombre: string;
  cantidad: number;
  monto: number;
};

export type EstadoPedidoPerfil = "pendiente" | "preparacion" | "envio" | "entregado" | "cancelado";

export type CompraPerfil = {
  id: string;
  fecha: string;
  origen: "local" | "web";
  titulo: string;
  total: number;
  detalle: string;
  descarga?: string;
  lineas: LineaCompraPerfil[];
  clase?: "pedido" | "compra" | "credito" | "recarga";
  proceso?: { paso: number; nota: string; estado?: EstadoPedidoPerfil };
  entrega?: string;
};

const PASOS_PEDIDO: { estado: EstadoPedidoPerfil; nombre: string; emoji: string }[] = [
  { estado: "pendiente", nombre: "Pendiente", emoji: "⏳" },
  { estado: "preparacion", nombre: "Preparación", emoji: "📦" },
  { estado: "envio", nombre: "Envío", emoji: "🚚" },
  { estado: "entregado", nombre: "Entregado", emoji: "✅" },
];

function claseEstado(estado: EstadoPedidoPerfil) {
  if (estado === "pendiente") return "estado-pendiente bg-amber-100 text-amber-900";
  if (estado === "preparacion") return "estado-preparacion bg-sky-100 text-sky-900";
  if (estado === "envio") return "estado-envio bg-orange-100 text-orange-900";
  if (estado === "entregado") return "bg-emerald-100 text-emerald-900";
  return "bg-neutral-200 text-neutral-600";
}

function PasosPedido({ estado, nota }: { estado?: EstadoPedidoPerfil; nota: string }) {
  const actual = Math.max(0, PASOS_PEDIDO.findIndex((paso) => paso.estado === estado));
  if (estado === "cancelado") {
    return <p className="mb-3 text-sm font-semibold text-cape">{nota}</p>;
  }
  return (
    <div className="mb-3">
      <ol className="grid grid-cols-4 gap-2">
        {PASOS_PEDIDO.map((paso, i) => {
          const activo = paso.estado === estado;
          return (
            <li key={paso.estado}>
              <span className={`block h-1.5 rounded-full ${i <= actual ? "bg-[#009ee3]" : "bg-neutral-200"}`} />
              <span
                className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                  activo ? "text-neutral-950" : "text-neutral-400"
                }`}
              >
                <span className={activo ? `inline-grid h-6 w-6 place-items-center rounded-full text-sm ${claseEstado(paso.estado)}` : ""}>
                  {paso.emoji}
                </span>
                {paso.nombre}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-neutral-700">{nota}</p>
    </div>
  );
}

function Saldo({
  titulo,
  limite,
  usado,
  vacio,
  detalleVacio,
}: {
  titulo: string;
  limite: number;
  usado: number;
  vacio: string;
  detalleVacio: string;
}) {
  const disponible = Math.max(0, limite - usado);
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  return (
    <article className="rounded-2xl bg-white px-5 py-5 shadow-sm">
      <p className="text-sm text-neutral-500">{titulo}</p>
      {limite <= 0 ? (
        <>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">{vacio}</p>
          <p className="mt-2 text-sm text-neutral-500">{detalleVacio}</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            {formatoPesos(disponible)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">Disponible</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-[#009ee3]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            Usado {formatoPesos(usado)} de {formatoPesos(limite)}
          </p>
        </>
      )}
    </article>
  );
}

function MontoGrande({ valor }: { valor: number }) {
  const texto = Math.max(0, Math.round(valor)).toLocaleString("es-AR");
  return (
    <p className="font-semibold tracking-tight text-neutral-950">
      <span className="align-top text-2xl">$</span>
      <span className="text-5xl sm:text-6xl">{texto}</span>
      <span className="text-2xl">,00</span>
    </p>
  );
}

export function PerfilCuenta({
  nombre,
  saldo,
  alias,
  cbu,
  titular,
  nombreLocal,
  limiteCredito,
  usadoCredito,
  cuotasMaximas,
  cuotasHabilitadas,
  interesModo,
  interes1,
  interes2,
  interes3,
  interes6,
  limiteMercaderia,
  usadoMercaderia,
  moraModo,
  moraPorcentaje,
  moraCreditoModo,
  moraCreditoPorcentaje,
  moraCuentaModo,
  moraCuentaPorcentaje,
  moraCredito,
  moraCuenta,
  tasasCuota,
  plazoCuenta,
  aliasCliente,
  onFaltaAlias,
  tickets,
  compras,
  verPrestamos = false,
  verCuenta = false,
  soloLectura = false,
}: {
  nombre: string;
  saldo: number;
  alias: string;
  cbu: string;
  titular: string;
  nombreLocal: string;
  limiteCredito: number;
  usadoCredito: number;
  cuotasMaximas?: 1 | 2 | 3 | 6;
  cuotasHabilitadas?: (1 | 2 | 3 | 6)[];
  interesModo?: "general" | "propio";
  interes1?: number;
  interes2?: number;
  interes3?: number;
  interes6?: number;
  limiteMercaderia: number;
  usadoMercaderia: number;
  moraModo?: "escala" | "fijo" | "sin";
  moraPorcentaje?: number;
  moraCreditoModo?: "escala" | "fijo" | "sin";
  moraCreditoPorcentaje?: number;
  moraCuentaModo?: "escala" | "fijo" | "sin";
  moraCuentaPorcentaje?: number;
  moraCredito?: number[];
  moraCuenta?: number[];
  tasasCuota?: { 1: number; 2: number; 3: number; 6: number };
  plazoCuenta?: number;
  aliasCliente?: string;
  onFaltaAlias?: () => void;
  tickets: TicketDeuda[];
  compras: CompraPerfil[];
  /** El local lo activó en la ficha. Si no, el perfil solo muestra pedidos y compras. */
  verPrestamos?: boolean;
  verCuenta?: boolean;
  /** En la ficha de caja se mira la cuenta, sin pedir crédito ni cargar saldo. */
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pantalla, setPantalla] = useState<"inicio" | "cargar" | "transferir" | "credito">("inicio");
  const [monto, setMonto] = useState("");
  const [aviso, setAviso] = useState("");
  const [simulacion, setSimulacion] = useState("");
  const [plazo, setPlazo] = useState<PlazoCredito>(1);
  const [pasoCredito, setPasoCredito] = useState<"simula" | "aviso">("simula");
  const [cuandoRecibe, setCuandoRecibe] = useState<"48h" | "fecha">("48h");
  const [diaCredito, setDiaCredito] = useState("");
  const [aceptaCredito, setAceptaCredito] = useState(false);
  const [pending, start] = useTransition();
  const fechaMinimaCredito = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(Date.now() + 48 * 60 * 60 * 1000));
  const credito = tasasCredito({
    cuotasMaximas,
    cuotasHabilitadas,
    interesModo,
    interes1,
    interes2,
    interes3,
    interes6,
    bases: tasasCuota,
  });
  const disponibleCredito = Math.max(0, limiteCredito - usadoCredito);
  const montoNum = Math.round(Number(monto) || 0);
  const politica = politicaDeCliente(
    {
      moraModo,
      moraPorcentaje,
      moraCreditoModo,
      moraCreditoPorcentaje,
      moraCuentaModo,
      moraCuentaPorcentaje,
    },
    { moraCredito, moraCuenta },
  );
  const moraDeCuenta = moraCuentaDe(politica);
  const moraDeCredito = moraCreditoDe(politica);
  const pagos = tickets
    .filter((t) => t.debe > 0 && t.estado !== "pagada")
    .map((t) => {
      const interes = interesDeTicket(t, undefined, politica);
      return { ticket: t, interes, vence: vencimientoDeTicket(t) };
    })
    .sort((a, b) => a.vence.localeCompare(b.vence));
  const pagosVisibles = pagos.filter(({ ticket }) => (ticket.tipo === "efectivo" ? verPrestamos : verCuenta));
  const comprasVisibles = compras.filter((compra) => {
    if (compra.clase === "credito") return verPrestamos;
    if (compra.clase === "recarga") return verCuenta;
    return true;
  });
  const avisoMora = `La mercadería del local no tiene interés. Tenés ${plazoCuenta ?? 7} días para pagarla. ${textoMoraSemanal(moraDeCuenta.modo, moraDeCuenta.porcentaje, "Pasado ese plazo", moraCuenta)}${limiteCredito > 0 ? ` ${textoMoraSemanal(moraDeCredito.modo, moraDeCredito.porcentaje, "Si se vence un crédito", moraCredito)}` : ""}`;

  function tecla(digito: string) {
    setMonto((actual) => {
      const siguiente = `${actual}${digito}`.replace(/^0+(?=\d)/, "");
      if (siguiente.length > 7) return actual;
      return siguiente;
    });
  }

  function confirmarTransferencia() {
    setAviso("");
    start(async () => {
      const resultado = await solicitarRecargaSaldo(montoNum);
      if (resultado?.error) {
        setAviso(resultado.error);
        return;
      }
      setAviso(resultado?.ok ?? "Listo.");
      setPantalla("inicio");
      setMonto("");
      router.refresh();
    });
  }

  const simulada = simularCredito(
    Math.min(disponibleCredito, Math.round(Number(simulacion) || 0)),
    plazo,
    credito.tasas[plazo],
  );

  return (
    <div className="space-y-3 rounded-3xl bg-[#f5f5f5] p-3 sm:p-4">
      <header className="flex items-center gap-3 px-2 pt-2">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#009ee3] text-lg font-bold text-white">
          {nombre.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="text-sm text-neutral-500">Hola</p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{nombre}</h1>
        </div>
      </header>
      {aviso && pantalla === "inicio" && (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-800">{aviso}</p>
      )}

      {(verPrestamos || verCuenta) && (
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
        {verCuenta && (
        <article className="rounded-3xl bg-white px-5 py-6 shadow-sm">
          <p className="text-sm font-semibold text-neutral-500">Pesos</p>
          <div className="mt-2">
            <MontoGrande valor={saldo} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">Saldo a cuenta</p>
          {!soloLectura && (
            <button
              type="button"
              onClick={() => {
                setAviso("");
                setMonto("");
                setPantalla("cargar");
              }}
              className="mt-5 rounded-full bg-[#009ee3] px-5 py-3 text-sm font-bold text-white"
            >
              Agregar saldo
            </button>
          )}
        </article>
        )}

        {verPrestamos && (
        <article className="relative overflow-hidden rounded-3xl bg-neutral-950 px-5 py-6 text-white shadow-sm">
          <span className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-[#009ee3]/40" />
          <p className="text-sm text-white/70">Créditos</p>
          {limiteCredito <= 0 ? (
            <p className="mt-6 text-xl font-semibold leading-snug">Todavía no tenés línea de crédito</p>
          ) : (
            <>
              <p className="mt-4 text-sm text-white/70">Con tu línea podés pedir hasta</p>
              <p className="mt-1 text-3xl font-semibold">{formatoPesos(disponibleCredito)}</p>
              <p className="mt-1 text-xs text-white/50">
                Usado {formatoPesos(usadoCredito)} de {formatoPesos(limiteCredito)}
              </p>
              {!soloLectura && (
                <button
                  type="button"
                  onClick={() => {
                    if (!aliasCliente?.trim()) {
                      onFaltaAlias?.();
                      return;
                    }
                    setSimulacion(String(Math.min(disponibleCredito, 10000) || ""));
                    setPlazo(credito.plazos[0] ?? 1);
                    setPasoCredito("simula");
                    setCuandoRecibe("48h");
                    setDiaCredito("");
                    setAceptaCredito(false);
                    setAviso("");
                    setPantalla("credito");
                  }}
                  className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-neutral-950"
                >
                  Pedir crédito
                </button>
              )}
            </>
          )}
        </article>
        )}
      </div>
      )}

      {verCuenta && (
      <Saldo
        titulo="Cuenta corriente de mercadería"
        limite={limiteMercaderia}
        usado={usadoMercaderia}
        vacio="No tenés cuenta de mercadería"
        detalleVacio="Cuando el local te habilite una, el disponible aparece acá."
      />
      )}

      {(verPrestamos || verCuenta) && <p className="px-2 text-sm text-neutral-500">{avisoMora}</p>}

      {(verPrestamos || verCuenta) && (
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <h2 className="border-b border-neutral-100 px-5 py-4 text-lg font-semibold text-neutral-950">
          A pagar
        </h2>
        {pagosVisibles.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">No tenés pagos pendientes.</p>
        ) : (
          <ul>
            {pagosVisibles.map(({ ticket, interes, vence }) => (
              <li key={ticket.id} className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4 last:border-b-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f7ff] text-sm font-bold text-[#009ee3]">
                  $
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-950">
                    Vence {formatoFecha(vence)}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {ticket.tipo === "efectivo" ? "Crédito" : "Mercadería"}
                    {" · "}
                    {ticket.origen === "web" ? "Pedido por internet" : "Compra en el local"}
                    {interes.interes > 0 ? ` · mora ${formatoPesos(interes.interes)}` : ""}
                  </span>
                </span>
                <span className="text-sm font-semibold text-neutral-950">
                  {formatoPesos(ticket.debe + interes.interes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <h2 className="border-b border-neutral-100 px-5 py-4 text-lg font-semibold text-neutral-950">
          Pedidos y compras
        </h2>
        {comprasVisibles.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">Todavía no hay pedidos ni compras en esta cuenta.</p>
        ) : (
          <ul>
            {comprasVisibles.map((compra) => {
              const abiertaAhora = abierta === compra.id;
              return (
                <li key={compra.id} className="border-b border-neutral-100 last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                    onClick={() => setAbierta(abiertaAhora ? null : compra.id)}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-base ${
                        compra.proceso?.estado ? claseEstado(compra.proceso.estado) : compra.origen === "web" ? "bg-[#e8f7ff]" : "bg-neutral-100"
                      }`}
                    >
                      {compra.proceso?.estado === "pendiente"
                        ? "⏳"
                        : compra.proceso?.estado === "preparacion"
                          ? "📦"
                          : compra.proceso?.estado === "envio"
                            ? "🚚"
                            : compra.proceso?.estado === "entregado"
                              ? "✅"
                              : compra.proceso?.estado === "cancelado"
                                ? "✕"
                                : compra.origen === "web"
                                  ? "Web"
                                  : "Local"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-950">
                        {compra.titulo}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {formatoFecha(compra.fecha.slice(0, 10))} · {compra.detalle}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-neutral-950">
                      {formatoPesos(compra.total)}
                    </span>
                    <span className="text-lg leading-none text-neutral-300">{abiertaAhora ? "˅" : "›"}</span>
                  </button>
                  {abiertaAhora && (
                    <div className="bg-[#fafafa] px-5 py-3">
                      <p className="text-xs font-semibold text-neutral-500">
                        {compra.origen === "web" ? "Pedido por internet" : "Compra en el local"} ·{" "}
                        {numeroVisibleTicket({ id: compra.id, numero: compra.titulo })}
                      </p>
                      {compra.proceso && <PasosPedido estado={compra.proceso.estado} nota={compra.proceso.nota} />}
                      {compra.entrega && (
                        <p className="mt-2 text-sm text-neutral-600">Entrega: {compra.entrega}</p>
                      )}
                      {compra.lineas.length === 0 ? (
                        <p className="mt-2 text-sm text-neutral-600">Este comprobante no tiene el detalle de productos.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                          {compra.lineas.map((linea, i) => (
                            <li key={`${compra.id}-${i}`} className="flex justify-between gap-3">
                              <span>
                                {linea.cantidad} × {nombreVitrina(linea.nombre)}
                              </span>
                              <span>{formatoPesos(linea.monto)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {compra.descarga && (
                        <a
                          href={compra.descarga}
                          className="mt-3 inline-flex text-sm font-semibold text-[#009ee3]"
                        >
                          Descargar comprobante
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pantalla === "cargar" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <section className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <p className="text-center text-sm text-neutral-500">¿Cuánto saldo querés cargar?</p>
            <div className="mt-3 text-center">
              <MontoGrande valor={montoNum} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((digito) => (
                <button
                  key={digito}
                  type="button"
                  onClick={() => tecla(digito)}
                  className={`h-14 rounded-2xl bg-neutral-100 text-2xl font-semibold ${digito === "0" ? "col-start-2" : ""}`}
                >
                  {digito}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMonto((actual) => actual.slice(0, -1))}
                className="col-start-3 h-14 rounded-2xl text-sm font-bold text-neutral-600"
              >
                Borrar
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-full border border-neutral-200 py-3 text-sm font-bold" onClick={() => setPantalla("inicio")}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={montoNum < 1}
                className="rounded-full bg-[#009ee3] py-3 text-sm font-bold text-white disabled:opacity-40"
                onClick={() => setPantalla("transferir")}
              >
                Continuar
              </button>
            </div>
          </section>
        </div>
      )}

      {pantalla === "transferir" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-sm font-semibold text-neutral-500">Transferí {formatoPesos(montoNum)}</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950">{nombreLocal || "MarvePack"}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">Titular</p>
            <p className="text-2xl font-semibold">{titular || "El local todavía no cargó el titular"}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">Alias</p>
            <p className="break-all text-3xl font-semibold text-[#009ee3]">{alias || "Sin alias"}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">CBU</p>
            <p className="break-all text-xl font-semibold">{cbu || "Sin CBU"}</p>
            {aviso && <p className="mt-3 text-sm font-semibold text-red-700">{aviso}</p>}
            <div className="mt-6 grid gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={confirmarTransferencia}
                className="rounded-full bg-[#009ee3] py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {pending ? "Avisando…" : "Ya transferí"}
              </button>
              <button type="button" className="rounded-full py-3 text-sm font-bold text-neutral-600" onClick={() => setPantalla("inicio")}>
                Cancelar ingreso
              </button>
            </div>
          </section>
        </div>
      )}

      {pantalla === "credito" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-sm text-neutral-500">Simulá tu línea</p>
            <h2 className="text-2xl font-semibold">Pedir crédito</h2>
            {pasoCredito === "simula" ? (
              <>
                <p className="mt-1 text-sm text-neutral-500">Disponible {formatoPesos(disponibleCredito)}</p>
                <label className="mt-4 block text-sm font-semibold">
                  Monto
                  <input
                    inputMode="numeric"
                    value={simulacion}
                    onChange={(e) => setSimulacion(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-3 text-2xl font-semibold outline-none focus:border-[#009ee3]"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {credito.plazos.map((opcion) => (
                    <button
                      key={opcion}
                      type="button"
                      onClick={() => setPlazo(opcion)}
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        plazo === opcion ? "bg-[#009ee3] text-white" : "bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      {opcion} {opcion === 1 ? "cuota" : "cuotas"}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-[#f5f5f5] p-4">
                  <p className="text-sm text-neutral-500">Cada cuota</p>
                  <p className="text-3xl font-semibold">{formatoPesos(simulada.cuota)}</p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Total {formatoPesos(simulada.total)} · interés {formatoPesos(simulada.interes)}
                  </p>
                </div>
                {aviso && <p className="mt-3 text-sm font-semibold text-cape">{aviso}</p>}
                <button
                  type="button"
                  disabled={simulada.capital < 1 || simulada.capital > disponibleCredito}
                  onClick={() => {
                    setAviso("");
                    setPasoCredito("aviso");
                  }}
                  className="mt-4 w-full rounded-full bg-[#009ee3] py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Continuar
                </button>
                <button type="button" className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-sm font-bold" onClick={() => setPantalla("inicio")}>
                  Volver
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold text-neutral-900">
                  Leé esto antes de confirmar. Si aceptás, el pedido queda pendiente hasta que el local lo apruebe.
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-700">
                  <li>Capital que pedís: {formatoPesos(simulada.capital)}.</li>
                  <li>
                    Tasa de interés: {simulada.tasa}% sobre el capital. El interés que se te cobra es {formatoPesos(simulada.interes)}.
                  </li>
                  <li>
                    Vas a devolver {formatoPesos(simulada.total)} en {simulada.cuotas}{" "}
                    {simulada.cuotas === 1 ? "cuota" : "cuotas"} de {formatoPesos(simulada.cuota)}.
                  </li>
                  <li>
                    Mora: {textoMoraSemanal(moraDeCredito.modo, moraDeCredito.porcentaje, "Si se vence el crédito", moraCredito)}
                  </li>
                  <li>
                    Los depósitos y las cancelaciones se pueden hacer en cualquier momento por el CBU {cbu || "que figura en tu cuenta"} o el alias {alias || "que figura en tu cuenta"}
                    {titular ? `, a nombre de ${titular}` : ""}.
                  </li>
                  <li>
                    El préstamo se pide con al menos 48 horas de anticipación. Podés recibirlo apenas pasen esas 48 horas desde la aprobación, o un día que elijas a partir del {formatoFecha(fechaMinimaCredito)}.
                  </li>
                  <li>
                    Descargo: al confirmar declarás que entendés la tasa, el interés, las cuotas, la mora y que el dinero no se entrega hasta que el local apruebe el pedido. Si lo rechaza, no se genera deuda.
                  </li>
                </ul>
                <fieldset className="mt-4 space-y-2">
                  <legend className="text-sm font-semibold">¿Cuándo querés recibir el dinero?</legend>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="cuando-credito"
                      checked={cuandoRecibe === "48h"}
                      onChange={() => setCuandoRecibe("48h")}
                      className="mt-1"
                    />
                    <span>Apenas pasen 48 horas de la aprobación.</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="cuando-credito"
                      checked={cuandoRecibe === "fecha"}
                      onChange={() => setCuandoRecibe("fecha")}
                      className="mt-1"
                    />
                    <span>Un día que yo elijo.</span>
                  </label>
                  {cuandoRecibe === "fecha" && (
                    <input
                      type="date"
                      min={fechaMinimaCredito}
                      value={diaCredito}
                      onChange={(e) => setDiaCredito(e.target.value)}
                      className="w-full rounded-2xl border border-neutral-200 px-3 py-3 text-sm font-semibold"
                    />
                  )}
                </fieldset>
                <label className="mt-4 flex items-start gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={aceptaCredito}
                    onChange={(e) => setAceptaCredito(e.target.checked)}
                    className="mt-1"
                  />
                  <span>Acepto estas condiciones y quiero pedir el crédito.</span>
                </label>
                {aviso && <p className="mt-3 text-sm font-semibold text-cape">{aviso}</p>}
                <button
                  type="button"
                  disabled={pending || !aceptaCredito}
                  onClick={() => {
                    setAviso("");
                    if (cuandoRecibe === "fecha" && (!diaCredito || diaCredito < fechaMinimaCredito)) {
                      setAviso("Elegí un día con al menos 48 horas de anticipación.");
                      return;
                    }
                    start(async () => {
                      const resultado = await solicitarCreditoCuenta({
                        monto: simulada.capital,
                        plazo,
                        cuando: cuandoRecibe,
                        fecha: diaCredito,
                      });
                      if (resultado?.error) {
                        setAviso(resultado.error);
                        return;
                      }
                      setAviso(resultado?.ok ?? "El pedido quedó pendiente.");
                      setPantalla("inicio");
                      setPasoCredito("simula");
                      setAceptaCredito(false);
                      router.refresh();
                    });
                  }}
                  className="mt-4 w-full rounded-full bg-[#009ee3] py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {pending ? "Enviando…" : "Confirmar pedido"}
                </button>
                <button
                  type="button"
                  className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-sm font-bold"
                  onClick={() => {
                    setAviso("");
                    setPasoCredito("simula");
                  }}
                >
                  Volver a la simulación
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
