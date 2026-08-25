import type { Metadata, Viewport } from "next";
import { Geist, Oswald } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { CartShell } from "@/components/CartShell";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { contarAlertasAdmin } from "@/app/acciones/cuentas";
import { BRAND_BLUE, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { urlBaseSitio } from "@/lib/site-url";
import { getSesion } from "@/lib/sesion";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const siteTitle = `${BRAND_NAME} | Descartables para tu negocio`;
const siteDescription =
  "Distribuidora de descartables en zona sur de Rosario, con cobertura en toda la ciudad. Envíos programados, catálogo online y WhatsApp directo.";

export const viewport: Viewport = {
  themeColor: BRAND_BLUE,
};

export const metadata: Metadata = {
  metadataBase: new URL(urlBaseSitio()),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: `${BRAND_TAGLINE}. Precios actualizados y atención directa por WhatsApp.`,
    locale: "es_AR",
    type: "website",
    images: [{ url: "/recursos/logo.jpg" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sesion = await getSesion();
  const alertasIniciales =
    sesion?.rol === "admin"
      ? await contarAlertasAdmin()
      : { solicitudes: 0, pedidosNuevos: 0 };

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${oswald.variable} h-full scroll-smooth`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <AuthProvider sesion={sesion}>
          <CartShell>
            <SiteHeader alertasIniciales={alertasIniciales} />
            {children}
            <SiteFooter />
            <FloatingWhatsapp />
          </CartShell>
        </AuthProvider>
      </body>
    </html>
  );
}
