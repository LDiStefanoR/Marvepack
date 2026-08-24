"use client";

import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { enviarPedidoWeb, leerMiPerfil } from "@/app/acciones/pedidos";
import {
  cantidadTotal,
  mensajePedidoWhatsApp,
  totalCarrito,
} from "@/lib/carrito";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import type { PerfilCliente } from "@/types/auth";

type PerfilSesion = {
  nombre: string;
  email: string;
  perfil?: PerfilCliente;
};

export function CartDrawer() {
  const sesion = useAuth();
  const { lineas, abierto, cerrar, setCantidad, quitar, vaciar } = useCart();
  const [viaWeb, setViaWeb] = useState(false);
  const [perfil, setPerfil] = useState<PerfilSesion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const total = totalCarrito(lineas);
  const unidades = cantidadTotal(lineas);
  const registrado = sesion?.rol === "cliente";

  useEffect(() => {
    if (!abierto) {
      setViaWeb(false);
      setMensaje(null);
      setError(null);
      return;
    }
    if (sesion?.rol === "cliente") {
      void leerMiPerfil().then(setPerfil);
    } else {
      setPerfil(null);
    }
  }, [abierto, sesion?.email, sesion?.rol]);

  const contactoGuardado = {
    nombre: perfil?.nombre ?? sesion?.nombre ?? "",
    email: perfil?.email ?? sesion?.email ?? "",
    telefono: perfil?.perfil?.telefono ?? "",
    direccion: perfil?.perfil?.direccion ?? "",
    horarios: perfil?.perfil?.horarioAtencion ?? "",
  };

  const wa = lineas.length
    ? whatsappUrl(
        mensajePedidoWhatsApp(lineas, {
          clienteRegistrado: registrado,
          contacto: registrado ? contactoGuardado : undefined,
        }),
      )
    : undefined;

  function onEnviarWeb(form: HTMLFormElement) {
    const data = new FormData(form);
    setError(null);
    setMensaje(null);
    start(async () => {
      const resultado = await enviarPedidoWeb(lineas, {
        nombre: String(data.get("nombre") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        telefono: String(data.get("telefono") ?? "").trim(),
        direccion: String(data.get("direccion") ?? "").trim(),
        horarios: String(data.get("horarios") ?? "").trim(),
      });
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      setMensaje(resultado?.ok ?? "Pedido enviado.");
      vaciar();
      setViaWeb(false);
    });
  }

  if (sesion?.rol === "admin") return null;
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar pedido"
        onClick={cerrar}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="carrito-titulo"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4">
          <h2 id="carrito-titulo" className="font-display text-xl font-bold not-italic text-movipack-deep">
            Tu pedido
          </h2>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-neutral-500 hover:bg-neutral-100"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {mensaje && (
            <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {mensaje}
            </p>
          )}
          {lineas.length === 0 && !mensaje ? (
            <p className="mt-8 text-center text-neutral-600">
              Todavía no agregaste productos. Recorré el catálogo y armá la
              lista.
            </p>
          ) : (
            <ul className="space-y-4">
              {lineas.map((linea) => (
                <li
                  key={linea.id}
                  className="rounded-xl border border-neutral-200 p-3"
                >
                  <p className="text-xs font-semibold text-neutral-400">
                    Cód. {linea.codigo}
                  </p>
                  <p className="font-semibold leading-snug text-movipack-deep">
                    {nombreVitrina(linea.nombre)}
                  </p>
                  <div className="mt-1 text-sm text-neutral-600">
                    {linea.precioLista &&
                    linea.precioLista !== linea.precio ? (
                      <div>
                        <p className="text-sm font-semibold text-neutral-400 line-through">
                          {formatoPesos(linea.precioLista)}
                        </p>
                        <p className="font-semibold text-movipack-deep">
                          {formatoPesos(linea.precio)} c/u
                        </p>
                      </div>
                    ) : (
                      <p>{formatoPesos(linea.precio)} c/u</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 font-bold"
                        onClick={() => setCantidad(linea.id, linea.cantidad - 1)}
                        aria-label="Quitar uno"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-bold">
                        {linea.cantidad}
                      </span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 font-bold"
                        onClick={() => setCantidad(linea.id, linea.cantidad + 1)}
                        aria-label="Agregar uno"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-movipack-deep">
                        {formatoPesos(linea.precio * linea.cantidad)}
                      </p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-cape hover:underline"
                        onClick={() => quitar(linea.id)}
                      >
                        Sacar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {viaWeb && lineas.length > 0 && (
            <form
              className="mt-6 space-y-3 rounded-xl border border-movipack/20 bg-[#f7faff] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                onEnviarWeb(e.currentTarget);
              }}
            >
              <p className="text-sm font-bold text-movipack-deep">
                Enviar a través de la web
              </p>
              <p className="text-xs text-neutral-600">
                {registrado
                  ? "Tus datos guardados ya están cargados. Revisalos y enviá."
                  : "Completá estos datos para que el administrador reciba el pedido."}
              </p>
              <Campo nombre="nombre" etiqueta="Nombre" required defaultValue={contactoGuardado.nombre} />
              <Campo nombre="direccion" etiqueta="Dirección" required defaultValue={contactoGuardado.direccion} />
              <Campo nombre="telefono" etiqueta="Teléfono" required defaultValue={contactoGuardado.telefono} />
              <Campo
                nombre="horarios"
                etiqueta="Horarios para recibir"
                required
                defaultValue={contactoGuardado.horarios}
              />
              <Campo
                nombre="email"
                etiqueta="Mail"
                type="email"
                required
                defaultValue={contactoGuardado.email}
              />
              {error && (
                <p className="text-sm font-semibold text-cape">{error}</p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-movipack px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {pending ? "Enviando…" : "Confirmar pedido web"}
              </button>
              <button
                type="button"
                className="w-full text-sm font-semibold text-neutral-500"
                onClick={() => setViaWeb(false)}
              >
                Volver
              </button>
            </form>
          )}
        </div>

        {lineas.length > 0 && !viaWeb && (
          <div className="border-t border-neutral-200 p-4">
            <p className="flex justify-between text-sm text-neutral-600">
              <span>
                {unidades} artículo{unidades === 1 ? "" : "s"}
              </span>
              <span className="font-bold text-movipack-deep">
                {formatoPesos(total)}
              </span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {registrado
                ? "Precio de cliente registrado. Podés mandarlo por WhatsApp o por la web."
                : "Precio de lista. Podés mandarlo por WhatsApp o por la web."}
            </p>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-cape px-6 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition hover:brightness-110"
              >
                Enviar pedido por WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setViaWeb(true);
                setError(null);
                setMensaje(null);
              }}
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-movipack px-6 text-sm font-bold text-movipack hover:bg-movipack/5"
            >
              Enviar a través de la web
            </button>
            <button
              type="button"
              onClick={vaciar}
              className="mt-3 w-full text-center text-sm font-semibold text-neutral-500 hover:text-cape"
            >
              Vaciar lista
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Campo({
  nombre,
  etiqueta,
  defaultValue,
  required,
  type = "text",
}: {
  nombre: string;
  etiqueta: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-600">
      {etiqueta}
      <input
        name={nombre}
        type={type}
        required={required}
        defaultValue={defaultValue}
        key={`${nombre}-${defaultValue ?? ""}`}
        className="mt-1 w-full rounded-lg border border-movipack/20 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-movipack"
      />
    </label>
  );
}
