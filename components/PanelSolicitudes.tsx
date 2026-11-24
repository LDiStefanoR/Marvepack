"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolverSolicitudRegistro, type EstadoAdminCuentas } from "@/app/acciones/cuentas";
import { DETALLE_TIPO_CUENTA, ETIQUETA_TIPO_CUENTA } from "@/lib/tipo-cuenta";
import type { UsuarioPublico } from "@/types/auth";

export function PanelSolicitudes({ solicitudes }: { solicitudes: UsuarioPublico[] }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoAdminCuentas>(null);
  const [pending, start] = useTransition();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-movipack">Administración</p>
      <h1 className="font-display text-3xl font-bold text-movipack-deep">Solicitudes de registro</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Revisá quién pidió cuenta, aceptala o rechazala. Si aceptás un cliente, la ficha se crea sola con estos datos.
      </p>
      <a href="/caja" className="mt-3 inline-block text-sm font-bold text-movipack underline">
        Volver a la caja
      </a>

      {mensaje?.error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-cape">{mensaje.error}</p>
      )}
      {mensaje?.ok && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{mensaje.ok}</p>
      )}

      {solicitudes.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-4 text-sm text-neutral-600 shadow-sm">
          No hay solicitudes pendientes.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {solicitudes.map((usuario) => {
            const perfil = usuario.perfil;
            return (
              <li key={usuario.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-display text-2xl font-bold text-movipack-deep">{usuario.nombre}</p>
                <p className="text-sm text-neutral-600">{usuario.email}</p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Dato etiqueta="Teléfono" valor={perfil?.telefono} />
                  <Dato etiqueta="Persona o empresa" valor={perfil?.tipoPersona} />
                  <Dato etiqueta="Tipo de local" valor={perfil?.tipoLocal} />
                  <Dato etiqueta="Dirección" valor={perfil?.direccion} />
                  <Dato etiqueta="Horario" valor={perfil?.horarioAtencion} />
                  <Dato
                    etiqueta="Entrega"
                    valor={perfil?.franjaReparto === "tarde" ? "Tarde, 18 a 20" : perfil?.franjaReparto === "manana" ? "Mañana, 9 a 13" : ""}
                  />
                  <Dato etiqueta="Productos que le interesan" valor={perfil?.productosInteres} />
                </dl>
                <FormSolicitud
                  usuarioId={usuario.id}
                  pending={pending}
                  onSubmit={(data) => {
                    setMensaje(null);
                    start(async () => {
                      const resultado = await resolverSolicitudRegistro(data);
                      setMensaje(resultado);
                      if (resultado?.ok) router.refresh();
                    });
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function FormSolicitud({
  usuarioId,
  pending,
  onSubmit,
}: {
  usuarioId: string;
  pending: boolean;
  onSubmit: (data: FormData) => void;
}) {
  const [tipo, setTipo] = useState("generico");
  const [credito, setCredito] = useState(false);
  return (
    <form
      className="mt-4 grid gap-3 border-t border-neutral-100 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const boton = (e.nativeEvent as SubmitEvent).submitter;
        if (boton instanceof HTMLButtonElement && boton.value) {
          data.set("decision", boton.value);
        }
        if (credito) data.set("credito", "1");
        onSubmit(data);
      }}
    >
      <input type="hidden" name="id" value={usuarioId} />
      <label className="text-sm font-bold">
        Perfil
        <select name="rol" defaultValue="cliente" className="mt-1 block w-full rounded-xl border px-3 py-2">
          <option value="cliente">Cliente</option>
          <option value="caja">Empleado de caja</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <label className="text-sm font-bold">
        Tipo de cuenta
        <span className="mt-1 block text-xs font-semibold text-neutral-600">
          Genérico: precio de lista, sin descuento. Con descuento especial: un porcentaje solo para este cliente.
        </span>
        <select
          name="tipoCuenta"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="mt-1 block w-full rounded-xl border px-3 py-2"
        >
          {Object.entries(ETIQUETA_TIPO_CUENTA).map(([id, etiqueta]) => (
            <option key={id} value={id} title={DETALLE_TIPO_CUENTA[id as keyof typeof DETALLE_TIPO_CUENTA]}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>
      {tipo === "descuento_especial" && (
        <label className="text-sm font-bold">
          Descuento especial %
          <input name="descuentoEspecial" type="number" min={0} max={90} defaultValue={0} className="mt-1 block w-28 rounded-xl border px-3 py-2" />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={credito} onChange={(e) => setCredito(e.target.checked)} />
        Crédito de mercadería
      </label>
      {credito && (
        <label className="text-sm font-bold">
          Cuánto de crédito dejás
          <input name="montoCredito" type="number" min={0} step={1000} defaultValue={0} className="mt-1 block w-40 rounded-xl border px-3 py-2" />
        </label>
      )}
      <p className="text-xs font-semibold text-neutral-600">Al aceptar un cliente, la ficha se crea sola.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="aceptar" disabled={pending} className="rounded-xl bg-movipack px-4 py-2 text-sm font-bold text-white">
          {pending ? "Guardando…" : "Aceptar"}
        </button>
        <button type="submit" name="decision" value="rechazar" disabled={pending} className="rounded-xl border border-cape px-4 py-2 text-sm font-bold text-cape">
          Rechazar
        </button>
      </div>
    </form>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  if (!valor?.trim()) return null;
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-neutral-500">{etiqueta}</dt>
      <dd className="text-neutral-800">{valor}</dd>
    </div>
  );
}
