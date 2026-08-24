"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminCambiarEstadoCuenta,
  adminCambiarEstadoPedido,
  adminCambiarPassword,
  adminCambiarRol,
  adminCrearUsuario,
  adminEliminarUsuario,
  adminGuardarPerfil,
  type EstadoAdminCuentas,
} from "@/app/acciones/cuentas";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import type { UsuarioPublico } from "@/types/auth";
import type { Pedido } from "@/types/pedido";

type Props = {
  pedidos: Pedido[];
  usuarios: UsuarioPublico[];
};

const btn =
  "rounded-lg border border-movipack/30 px-3 py-1.5 text-xs font-bold text-movipack disabled:opacity-60";
const campo =
  "w-full rounded-lg border border-movipack/20 px-3 py-2 text-sm outline-none focus:border-movipack";

export function AdminClientesPedidos({ pedidos, usuarios }: Props) {
  const router = useRouter();
  const [pestania, setPestania] = useState<"pedidos" | "solicitudes" | "usuarios">(
    "pedidos",
  );
  const [mensaje, setMensaje] = useState<EstadoAdminCuentas>(null);
  const [pending, start] = useTransition();

  const solicitudes = usuarios.filter((u) => u.estado === "pendiente");

  function run(tarea: () => Promise<EstadoAdminCuentas>) {
    setMensaje(null);
    start(async () => {
      const resultado = await tarea();
      setMensaje(resultado);
      if (resultado?.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Pestania
          activa={pestania === "pedidos"}
          onClick={() => setPestania("pedidos")}
          texto={`Pedidos (${pedidos.length})`}
        />
        <Pestania
          activa={pestania === "solicitudes"}
          onClick={() => setPestania("solicitudes")}
          texto={`Solicitudes (${solicitudes.length})`}
        />
        <Pestania
          activa={pestania === "usuarios"}
          onClick={() => setPestania("usuarios")}
          texto={`Usuarios (${usuarios.length})`}
        />
      </div>

      {mensaje?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-cape">
          {mensaje.error}
        </p>
      )}
      {mensaje?.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {mensaje.ok}
        </p>
      )}

      {pestania === "pedidos" && (
        <ul className="space-y-4">
          {pedidos.length === 0 && (
            <p className="text-sm text-neutral-600">Todavía no hay pedidos web.</p>
          )}
          {pedidos.map((pedido) => (
            <li
              key={pedido.id}
              className="rounded-2xl border border-movipack/15 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-400">
                    {new Date(pedido.creadoEn).toLocaleString("es-AR")} ·{" "}
                    {pedido.clienteRegistrado ? "Cliente registrado" : "Sin cuenta"}
                  </p>
                  <p className="mt-1 font-bold text-movipack-deep">
                    {pedido.contacto.nombre} · {formatoPesos(pedido.total)}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {pedido.contacto.direccion}
                    <br />
                    Tel. {pedido.contacto.telefono} · {pedido.contacto.email}
                    <br />
                    Horarios: {pedido.contacto.horarios}
                  </p>
                </div>
                <select
                  defaultValue={pedido.estado}
                  disabled={pending}
                  className="rounded-lg border border-movipack/20 bg-white px-3 py-2 text-sm font-semibold"
                  onChange={(e) => {
                    const data = new FormData();
                    data.set("id", pedido.id);
                    data.set("estado", e.target.value);
                    run(() => adminCambiarEstadoPedido(data));
                  }}
                >
                  <option value="sin_atender">Sin atender</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="terminado">Terminado</option>
                </select>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-neutral-700">
                {pedido.lineas.map((linea) => (
                  <li key={`${pedido.id}-${linea.id}`}>
                    {linea.cantidad} × {nombreVitrina(linea.nombre)} (cód.{" "}
                    {linea.codigo}) — {formatoPesos(linea.precio * linea.cantidad)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {pestania === "solicitudes" && (
        <ul className="space-y-4">
          {solicitudes.length === 0 && (
            <p className="text-sm text-neutral-600">No hay solicitudes pendientes.</p>
          )}
          {solicitudes.map((usuario) => (
            <li
              key={usuario.id}
              className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4"
            >
              <p className="font-bold text-movipack-deep">{usuario.nombre}</p>
              <p className="text-sm text-neutral-600">{usuario.email}</p>
              {usuario.perfil && (
                <dl className="mt-3 grid gap-1 text-sm text-neutral-700 sm:grid-cols-2">
                  <dt className="font-semibold">Tipo</dt>
                  <dd>
                    {usuario.perfil.tipoPersona === "empresa" ? "Empresa" : "Persona"} ·{" "}
                    {usuario.perfil.tipoLocal}
                  </dd>
                  <dt className="font-semibold">Interés</dt>
                  <dd>{usuario.perfil.productosInteres}</dd>
                  <dt className="font-semibold">Dirección</dt>
                  <dd>{usuario.perfil.direccion}</dd>
                  <dt className="font-semibold">Teléfono</dt>
                  <dd>{usuario.perfil.telefono}</dd>
                  <dt className="font-semibold">Horario</dt>
                  <dd>{usuario.perfil.horarioAtencion}</dd>
                  <dt className="font-semibold">Asesor</dt>
                  <dd>{usuario.perfil.deseaAsesor ? "Sí, quiere que lo llamen" : "No"}</dd>
                </dl>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg bg-movipack px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", usuario.id);
                    data.set("estado", "activa");
                    run(() => adminCambiarEstadoCuenta(data));
                  }}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg border border-cape px-3 py-2 text-sm font-bold text-cape disabled:opacity-60"
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", usuario.id);
                    data.set("estado", "rechazada");
                    run(() => adminCambiarEstadoCuenta(data));
                  }}
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pestania === "usuarios" && (
        <div className="space-y-6">
          <form
            className="rounded-2xl border border-dashed border-movipack/30 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              run(async () => {
                const resultado = await adminCrearUsuario(new FormData(form));
                if (resultado?.ok) form.reset();
                return resultado;
              });
            }}
          >
            <p className="font-bold text-movipack-deep">Agregar usuario</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="nombre" required placeholder="Nombre" className={campo} />
              <input name="email" type="email" required placeholder="Mail" className={campo} />
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Contraseña"
                className={campo}
              />
              <select name="rol" className={campo} defaultValue="cliente">
                <option value="cliente">Permiso general</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button type="submit" disabled={pending} className={`${btn} mt-3`}>
              Crear cuenta activa
            </button>
          </form>

          <ul className="space-y-4">
            {usuarios.map((usuario) => (
              <li
                key={usuario.id}
                className="rounded-2xl border border-movipack/15 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-movipack-deep">{usuario.nombre}</p>
                    <p className="text-sm text-neutral-600">{usuario.email}</p>
                    <p className="text-xs font-semibold text-neutral-400">
                      {usuario.rol === "admin" ? "Administrador" : "General"} ·{" "}
                      {usuario.estado}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      defaultValue={usuario.rol}
                      disabled={pending}
                      className="rounded-lg border border-movipack/20 px-2 py-1 text-sm font-semibold"
                      onChange={(e) => {
                        const data = new FormData();
                        data.set("id", usuario.id);
                        data.set("rol", e.target.value);
                        run(() => adminCambiarRol(data));
                      }}
                    >
                      <option value="cliente">General</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-sm font-bold text-cape hover:underline disabled:opacity-60"
                      onClick={() => {
                        const ok = window.confirm(`¿Eliminar a ${usuario.email}?`);
                        if (!ok) return;
                        const data = new FormData();
                        data.set("id", usuario.id);
                        run(() => adminEliminarUsuario(data));
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    run(async () => {
                      const resultado = await adminCambiarPassword(new FormData(form));
                      if (resultado?.ok) form.reset();
                      return resultado;
                    });
                  }}
                >
                  <input type="hidden" name="id" value={usuario.id} />
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Nueva contraseña"
                    className="min-w-40 flex-1 rounded-lg border border-movipack/20 px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={pending} className={btn}>
                    Cambiar contraseña
                  </button>
                </form>

                <form
                  className="mt-4 grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => adminGuardarPerfil(new FormData(e.currentTarget)));
                  }}
                >
                  <input type="hidden" name="id" value={usuario.id} />
                  <input
                    name="nombre"
                    required
                    defaultValue={usuario.nombre}
                    className={campo}
                    placeholder="Nombre"
                  />
                  <select
                    name="tipoPersona"
                    className={campo}
                    defaultValue={usuario.perfil?.tipoPersona ?? "persona"}
                  >
                    <option value="persona">Persona</option>
                    <option value="empresa">Empresa</option>
                  </select>
                  <input
                    name="tipoLocal"
                    placeholder="Tipo de local"
                    defaultValue={usuario.perfil?.tipoLocal ?? ""}
                    className={campo}
                  />
                  <input
                    name="telefono"
                    placeholder="Teléfono"
                    defaultValue={usuario.perfil?.telefono ?? ""}
                    className={campo}
                  />
                  <input
                    name="direccion"
                    placeholder="Dirección"
                    defaultValue={usuario.perfil?.direccion ?? ""}
                    className={`${campo} sm:col-span-2`}
                  />
                  <input
                    name="horarioAtencion"
                    placeholder="Horario de atención"
                    defaultValue={usuario.perfil?.horarioAtencion ?? ""}
                    className={campo}
                  />
                  <select
                    name="deseaAsesor"
                    className={campo}
                    defaultValue={usuario.perfil?.deseaAsesor ? "si" : "no"}
                  >
                    <option value="no">No quiere asesor</option>
                    <option value="si">Quiere que un asesor se comunique</option>
                  </select>
                  <textarea
                    name="productosInteres"
                    placeholder="Productos de interés"
                    defaultValue={usuario.perfil?.productosInteres ?? ""}
                    className={`${campo} sm:col-span-2`}
                    rows={2}
                  />
                  <button type="submit" disabled={pending} className={`${btn} sm:col-span-2 w-fit`}>
                    Guardar datos de contacto
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Pestania({
  activa,
  onClick,
  texto,
}: {
  activa: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold ${
        activa
          ? "border-movipack-dark bg-movipack text-white"
          : "border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {texto}
    </button>
  );
}
