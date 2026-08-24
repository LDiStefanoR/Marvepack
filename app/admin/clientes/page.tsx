import { redirect } from "next/navigation";
import { AdminClientesPedidos } from "@/components/AdminClientesPedidos";
import { AdminNav } from "@/components/AdminNav";
import { listarPedidos } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios, sinPassword } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar");

  const [pedidos, usuariosRaw] = await Promise.all([
    listarPedidos(),
    listarUsuarios(),
  ]);
  const usuarios = usuariosRaw.map(sinPassword);
  const solicitudes = usuarios.filter((u) => u.estado === "pendiente").length;
  const pedidosNuevos = pedidos.filter((p) => p.estado === "sin_atender").length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-cape">
        Administración
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
        Clientes y pedidos
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Pedidos enviados por la web, solicitudes de cuenta y usuarios. Acá
        aceptás altas, cambiás permisos y seguís cada pedido.
      </p>
      <AdminNav
        activa="clientes"
        solicitudes={solicitudes}
        pedidosNuevos={pedidosNuevos}
      />
      <div className="mt-8">
        <AdminClientesPedidos pedidos={pedidos} usuarios={usuarios} />
      </div>
    </main>
  );
}
