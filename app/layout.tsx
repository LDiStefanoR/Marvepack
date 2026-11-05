import type { Metadata, Viewport } from "next";
import { Geist, Oswald } from "next/font/google";
import { contarAlertasAdmin } from "@/app/acciones/cuentas";
import { leerDatosLocal } from "@/app/acciones/local";
import { AdminAlarma } from "@/components/AdminAlarma";
import { AuthProvider } from "@/components/AuthProvider";
import { CartShell } from "@/components/CartShell";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { OcultarEnCaja } from "@/components/OcultarEnCaja";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { leerAjustes } from "@/lib/ajustes";
import { BRAND_BLUE, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { datosLocalDesde } from "@/lib/datos-local";
import { ENVIO_BASE } from "@/lib/envio";
import { urlBaseSitio } from "@/lib/site-url";
import { getSesion } from "@/lib/sesion";
import type { AlertasAdmin } from "@/types/cuenta";
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
  "Envíos en toda Rosario. Catálogo por WhatsApp y online, precios al por mayor en PDF y descuentos distintos para clientes y empleados.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
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
  let alertasIniciales: AlertasAdmin = {
    solicitudes: 0,
    pedidosNuevos: 0,
    novedades: 0,
    total: 0,
  };
  let datosLocal = datosLocalDesde(null);
  let envio = ENVIO_BASE;
  try {
    envio = (await leerAjustes()).envio;
  } catch (error) {
    console.error("[layout] envío", error);
  }
  try {
    datosLocal = await leerDatosLocal();
  } catch (error) {
    console.error("[layout] datos del local", error);
  }
  if (sesion?.rol === "admin") {
    try {
      alertasIniciales = await contarAlertasAdmin();
    } catch (error) {
      console.error("[layout] alertas admin", error);
    }
  }

  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${oswald.variable} h-full scroll-smooth`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <AuthProvider sesion={sesion}>
          <CartShell envio={envio}>
            <OcultarEnCaja>
              <SiteHeader />
              {sesion?.rol === "admin" && <AdminAlarma inicial={alertasIniciales} />}
            </OcultarEnCaja>
            {children}
            <OcultarEnCaja>
              <SiteFooter datos={datosLocal} />
              <FloatingWhatsapp telefono={datosLocal.telefono} />
            </OcultarEnCaja>
          </CartShell>
        </AuthProvider>
      </body>
    </html>
  );
}
