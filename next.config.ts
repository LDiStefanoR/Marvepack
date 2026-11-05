import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "bcryptjs",
    "exceljs",
    "pdfkit",
    "googleapis",
    "@vercel/blob",
    "cloudinary",
    "@libsql/client",
    "sharp",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "./recursos/imagenes-productos/auto-*",
      "./public/recursos/imagenes-productos/auto-*",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/recursos/imagenes-productos/:file",
        destination:
          "https://raw.githubusercontent.com/LDiStefanoR/Marvepack/main/recursos/imagenes-productos/:file",
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
