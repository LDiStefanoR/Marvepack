"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CARRITO_STORAGE_KEY,
  type LineaCarrito,
} from "@/lib/carrito";
import { preciosParaCarrito } from "@/app/acciones/precios";
import { useAuth } from "@/components/AuthProvider";
import type { ProductoVitrina } from "@/types/producto";

type CartContextValue = {
  lineas: LineaCarrito[];
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  agregar: (producto: ProductoVitrina) => void;
  setCantidad: (id: string, cantidad: number) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const sesion = useAuth();
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CARRITO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LineaCarrito[];
        if (Array.isArray(parsed)) setLineas(parsed);
      }
    } catch {
      /* ignore */
    }
    setListo(true);
  }, []);

  const idsCarrito = lineas.map((l) => l.id).join("|");

  useEffect(() => {
    if (!listo || lineas.length === 0) return;
    const ids = [...new Set(lineas.map((l) => l.id))];
    void preciosParaCarrito(ids).then((precios) => {
      setLineas((prev) =>
        prev.map((linea) => {
          const actualizado = precios.find((p) => p.id === linea.id);
          if (!actualizado) return linea;
          if (
            actualizado.precio === linea.precio &&
            actualizado.precioLista === linea.precioLista &&
            actualizado.descuentoCliente === linea.descuentoCliente
          ) {
            return linea;
          }
          return {
            ...linea,
            precio: actualizado.precio,
            precioLista: actualizado.precioLista,
            descuentoCliente: actualizado.descuentoCliente,
          };
        }),
      );
    });
  }, [sesion?.email, sesion?.rol, listo, idsCarrito, lineas.length]);

  useEffect(() => {
    if (!listo) return;
    localStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify(lineas));
  }, [lineas, listo]);

  const agregar = useCallback((producto: ProductoVitrina) => {
    setLineas((prev) => {
      const existente = prev.find((l) => l.id === producto.id);
      if (existente) {
        return prev.map((l) =>
          l.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          precio: producto.precioMostrar,
          precioLista: producto.precioLista,
          descuentoCliente: producto.descuentoCliente,
          cantidad: 1,
        },
      ];
    });
    setAbierto(true);
  }, []);

  const setCantidad = useCallback((id: string, cantidad: number) => {
    setLineas((prev) => {
      if (cantidad < 1) return prev.filter((l) => l.id !== id);
      return prev.map((l) => (l.id === id ? { ...l, cantidad } : l));
    });
  }, []);

  const quitar = useCallback((id: string) => {
    setLineas((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const vaciar = useCallback(() => setLineas([]), []);

  const value = useMemo(
    () => ({
      lineas,
      abierto,
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
      agregar,
      setCantidad,
      quitar,
      vaciar,
    }),
    [lineas, abierto, agregar, setCantidad, quitar, vaciar],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }
  return ctx;
}
