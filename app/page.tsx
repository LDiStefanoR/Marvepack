import { AboutSection } from "@/components/AboutSection";
import { CatalogPreview } from "@/components/CatalogPreview";
import { ClientsSection } from "@/components/ClientsSection";
import { ContactSection } from "@/components/ContactSection";
import { DeliverySection } from "@/components/DeliverySection";
import { FindUsSection } from "@/components/FindUsSection";
import { HeroSection } from "@/components/HeroSection";
import { leerProductos } from "@/lib/productos";
import { leerRubros } from "@/lib/rubros";

export default async function Home() {
  const productos = await leerProductos();
  const rubros = await leerRubros(productos.map((p) => p.seccion));

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
