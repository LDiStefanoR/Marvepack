"use client";

import { useState } from "react";
import { caja } from "@/components/caja-estilo";
import { ETIQUETA_VERSION, HISTORIAL_VERSIONES } from "@/lib/version";

export function CajaVersion({ className = "" }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 underline-offset-4 hover:text-confetti hover:underline ${className}`}
      >
        {ETIQUETA_VERSION}
      </button>
      {abierto && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-auto bg-black/50 p-4 pt-10">
          <div className={`${caja.popup} max-w-lg`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={caja.kicker}>Programa</p>
                <h3 className="font-display text-2xl font-bold">{ETIQUETA_VERSION}</h3>
                <p className="mt-1 text-sm text-neutral-600">
                  Cada actualización en internet suma 0,1. Tocá la versión del menú para ver qué cambió.
                </p>
              </div>
              <button type="button" className={caja.boton} onClick={() => setAbierto(false)}>
                Cerrar
              </button>
            </div>
            <ol className="mt-5 space-y-4">
              {HISTORIAL_VERSIONES.map((entrada) => (
                <li key={entrada.version} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <p className="font-display text-lg font-bold">Beta {entrada.version}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{entrada.fecha}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {entrada.cambios.map((cambio) => (
                      <li key={cambio}>{cambio}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
