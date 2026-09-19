import { NextResponse } from "next/server";
import { getSesion } from "@/lib/sesion";
import { cloudinaryActivo, subirFotoCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const sesion = await getSesion();
  if (sesion?.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador." }, { status: 401 });
  }
  if (!cloudinaryActivo()) {
    return NextResponse.json(
      { error: "Faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const archivo = form.get("imagen");
  const carpetaRaw = String(form.get("carpeta") ?? "imagenes-productos");
  const carpeta =
    carpetaRaw === "imagenes-rubros" || carpetaRaw === "web"
      ? carpetaRaw
      : "imagenes-productos";

  if (!(archivo instanceof Blob) || archivo.size === 0) {
    return NextResponse.json({ error: "Elegí una imagen." }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen no puede pesar más de 5 MB." }, { status: 400 });
  }
  const mime = archivo.type || "image/jpeg";
  if (!TIPOS.has(mime) && !TIPOS.has(archivo.type)) {
    return NextResponse.json({ error: "Usá JPG, PNG o WebP." }, { status: 400 });
  }

  const ext =
    mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
  const codigo = String(form.get("codigo") ?? "prod").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  const nombre = `carga-${codigo || "prod"}-${Date.now()}${ext}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  try {
    const url = await subirFotoCloudinary({
      carpeta,
      nombre,
      buffer,
      mime,
    });
    if (!url) {
      return NextResponse.json({ error: "No se pudo subir a Cloudinary." }, { status: 500 });
    }
    return NextResponse.json({ url, secure_url: url });
  } catch (error) {
    console.error("[api/imagenes]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo subir la imagen.",
      },
      { status: 500 },
    );
  }
}
