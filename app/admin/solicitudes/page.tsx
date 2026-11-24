import { redirect } from "next/navigation";
import { PanelSolicitudes } from "@/components/PanelSolicitudes";
import { getSesion } from "@/lib/sesion";
import { listarUsuarios } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function SolicitudesPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") redirect("/ingresar?siguiente=/admin/solicitudes");
  const usuarios = await listarUsuarios();
  const solicitudes = usuarios.filter((u) => u.estado === "pendiente");
  return <PanelSolicitudes solicitudes={solicitudes} />;
}
