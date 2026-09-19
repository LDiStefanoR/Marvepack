import { v2 as cloudinary } from "cloudinary";

function cloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
}

function apiKey() {
  return process.env.CLOUDINARY_API_KEY?.trim() || "";
}

function apiSecret() {
  return process.env.CLOUDINARY_API_SECRET?.trim() || "";
}

export function cloudinaryActivo() {
  return Boolean(cloudName() && apiKey() && apiSecret());
}

function configurar() {
  cloudinary.config({
    cloud_name: cloudName(),
    api_key: apiKey(),
    api_secret: apiSecret(),
    secure: true,
  });
}

function publicIdDeNombre(nombre: string) {
  return nombre.replace(/\.[a-z0-9]+$/i, "") || nombre;
}

export function esUrlCloudinary(url: string) {
  return /res\.cloudinary\.com/i.test(url);
}

export async function subirFotoCloudinary(opts: {
  carpeta: string;
  nombre: string;
  buffer: Buffer;
  mime: string;
}) {
  if (!cloudinaryActivo()) return null;
  configurar();
  const folder = `marvepack/${opts.carpeta}`;
  const publicId = publicIdDeNombre(opts.nombre);

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
        unique_filename: false,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error("Cloudinary no devolvió secure_url."));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(opts.buffer);
  });
}

export async function borrarFotoCloudinary(url: string) {
  if (!cloudinaryActivo() || !esUrlCloudinary(url)) return;
  configurar();
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+(?:\?.*)?$/i);
  const publicId = match?.[1];
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId).catch((error) => {
    console.error("[cloudinary] borrar", error);
  });
}
