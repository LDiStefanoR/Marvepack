import { BrandLogo } from "@/components/BrandLogo";
import { MENSAJE_PEDIDO_GENERAL } from "@/lib/categorias";
import { whatsappPhoneDisplay, whatsappUrl } from "@/lib/whatsapp";

export function SiteFooter() {
  const wa = whatsappUrl(MENSAJE_PEDIDO_GENERAL);

  return (
    <footer className="border-t border-movipack/20 bg-[#111111] text-neutral-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="w-fit rounded-2xl bg-white p-3 shadow-lg shadow-black/20 ring-1 ring-white/20">
            <BrandLogo variant="footer" />
          </div>
          <div>
            <p className="text-sm text-neutral-400">
              Zona sur · Cobertura en todo Rosario
            </p>
            <p className="text-sm text-neutral-400">
              Hilarión de la Quintana 2667
            </p>
          </div>
        </div>
        <div className="text-sm">
          <a
            href={wa}
            className="font-semibold text-emerald-400 hover:underline"
          >
            {whatsappPhoneDisplay()}
          </a>
          <p className="mt-1 text-neutral-400">Lun–vie 9–18 · Sáb 9–12</p>
        </div>
      </div>
    </footer>
  );
}
