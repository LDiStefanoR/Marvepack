import { AboutSection } from "@/components/AboutSection";
import { CatalogPreview } from "@/components/CatalogPreview";
import { ClientsSection } from "@/components/ClientsSection";
import { ContactSection } from "@/components/ContactSection";
import { DeliverySection } from "@/components/DeliverySection";
import { FindUsSection } from "@/components/FindUsSection";
import { HeroSection } from "@/components/HeroSection";
import { leerProductos } from "@/lib/productos";
import { leerRubros } from "@/lib/rubros";

export const dynamic = "force-dynamic";

export default async function Home() {
  let productos: Awaited<ReturnType<typeof leerProductos>> = [];
  let rubros: Awaited<ReturnType<typeof leerRubros>> = [];
  try {
    productos = await leerProductos();
    rubros = await leerRubros(productos.map((p) => p.seccion));
  } catch (error) {
    console.error("[home] catálogo", error);
  }

  return (
    <main>
      <HeroSection />
      <AboutSection />
      <ClientsSection />
      <DeliverySection />
      <CatalogPreview productos={productos} rubros={rubros} />
      <FindUsSection />
      <ContactSection />
    </main>
  );
}
