"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { contarAlertasAdmin } from "@/app/acciones/cuentas";
import { useAuth } from "@/components/AuthProvider";

function asegurarContexto(actual: AudioContext | null) {
  if (actual && actual.state !== "closed") return actual;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

function iniciarSirena(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.12;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  let agudo = true;
  const tick = window.setInterval(() => {
    agudo = !agudo;
    osc.frequency.setValueAtTime(agudo ? 1180 : 740, ctx.currentTime);
    gain.gain.setValueAtTime(agudo ? 0.14 : 0.08, ctx.currentTime);
  }, 280);

  return () => {
    window.clearInterval(tick);
    try {
      osc.stop();
    } catch {
      /* ya parado */
    }
    osc.disconnect();
    gain.disconnect();
  };
}

export function AdminPedidoAlarma() {
  const sesion = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [nuevos, setNuevos] = useState(0);
  const [sonidoBloqueado, setSonidoBloqueado] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const tituloOriginal = useRef<string | null>(null);
  const prevNuevos = useRef(0);

  useEffect(() => {
    if (sesion?.rol !== "admin") return;

    let cancelado = false;

    async function refrescar() {
      const actual = await contarAlertasAdmin();
      if (cancelado) return;
      setNuevos(actual.pedidosNuevos);
      if (actual.pedidosNuevos !== prevNuevos.current) {
        prevNuevos.current = actual.pedidosNuevos;
        router.refresh();
      }
    }

    void refrescar();
    const id = window.setInterval(() => void refrescar(), 4000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [sesion?.rol, pathname, router]);

  useEffect(() => {
    if (sesion?.rol !== "admin") return;

    const desbloquear = () => {
      const ctx = asegurarContexto(ctxRef.current);
      ctxRef.current = ctx;
      void ctx?.resume().then(() => {
        if (ctx?.state === "running") setSonidoBloqueado(false);
      });
    };

    window.addEventListener("pointerdown", desbloquear);
    window.addEventListener("keydown", desbloquear);
    return () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, [sesion?.rol]);

  useEffect(() => {
    if (sesion?.rol !== "admin") {
      stopRef.current?.();
      stopRef.current = null;
      return;
    }

    if (nuevos <= 0) {
      stopRef.current?.();
      stopRef.current = null;
      setSonidoBloqueado(false);
      if (tituloOriginal.current) {
        document.title = tituloOriginal.current;
        tituloOriginal.current = null;
      }
      return;
    }

    if (!tituloOriginal.current) tituloOriginal.current = document.title;
    document.title = `¡${nuevos} pedido${nuevos === 1 ? "" : "s"} nuevo${nuevos === 1 ? "" : "s"}!`;

    const ctx = asegurarContexto(ctxRef.current);
    ctxRef.current = ctx;
    if (!ctx) return;

    let vivo = true;
    void ctx.resume().then(() => {
      if (!vivo) return;
      if (ctx.state !== "running") {
        setSonidoBloqueado(true);
        return;
      }
      setSonidoBloqueado(false);
      if (!stopRef.current) stopRef.current = iniciarSirena(ctx);
    });

    return () => {
      vivo = false;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [nuevos, sesion?.rol]);

  useEffect(() => {
    return () => {
      stopRef.current?.();
      if (tituloOriginal.current) document.title = tituloOriginal.current;
      void ctxRef.current?.close();
    };
  }, []);

  if (sesion?.rol !== "admin" || nuevos <= 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border-2 border-cape bg-cape px-4 py-3 text-white shadow-2xl shadow-red-900/40 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold">
          {nuevos === 1
            ? "Hay 1 pedido web sin atender. La alarma suena hasta que lo pongas en proceso."
            : `Hay ${nuevos} pedidos web sin atender. La alarma suena hasta que los pongas en proceso.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {sonidoBloqueado && (
            <button
              type="button"
              className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-cape"
              onClick={() => {
                const ctx = asegurarContexto(ctxRef.current);
                ctxRef.current = ctx;
                void ctx?.resume().then(() => {
                  if (ctx?.state === "running") {
                    setSonidoBloqueado(false);
                    if (!stopRef.current) stopRef.current = iniciarSirena(ctx);
                  }
                });
              }}
            >
              Activar sonido
            </button>
          )}
          <Link
            href="/admin/clientes"
            className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-cape"
          >
            Ver pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
