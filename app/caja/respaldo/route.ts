import { NextRequest } from "next/server";
import {
  armarExcelRespaldo,
  armarZipRespaldo,
  nombreArchivoRespaldo,
} from "@/lib/respaldo";
import { getSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return new Response("No autorizado", { status: 401 });
  }

  const formato = request.nextUrl.searchParams.get("formato") || "zip";

  try {
    if (formato === "xlsx") {
      const archivo = await armarExcelRespaldo();
      const nombre = nombreArchivoRespaldo("xlsx");
      return new Response(new Uint8Array(archivo), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${nombre}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (formato === "zip") {
      const archivo = await armarZipRespaldo();
      const nombre = nombreArchivoRespaldo("zip");
      return new Response(new Uint8Array(archivo), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${nombre}"`,
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (error) {
    console.error("[respaldo]", error);
    return new Response(
      error instanceof Error ? error.message : "No se pudo armar el respaldo.",
      { status: 500 },
    );
  }

  return new Response("Formato no válido. Usá formato=xlsx o formato=zip.", {
    status: 400,
  });
}
