"use client";

import { useState } from "react";
import { caja } from "@/components/caja-estilo";

const CAMPO = caja.campo;

export function CajaClienteForm({
  pending,
  aviso,
  tasasCuota,
  moraCredito = [5, 10, 20, 40],
  moraCuenta = [5, 10, 20, 40],
  plazoGeneral = 7,
  onCancelar,
  onCrear,
}: {
  pending: boolean;
  aviso: string;
  tasasCuota?: { 1: number; 2: number; 3: number; 6: number };
  moraCredito?: number[];
  moraCuenta?: number[];
  plazoGeneral?: number;
  onCancelar: () => void;
  onCrear: (form: FormData) => void;
}) {
  const [web, setWeb] = useState(false);
  const [credito, setCredito] = useState(false);
  const [corriente, setCorriente] = useState(false);

  return (
    <form
      className={`${caja.panel} p-4`}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (web) data.set("cuentaWeb", "1");
        if (credito) data.set("credito", "1");
        if (corriente) data.set("cuentaCorriente", "1");
        onCrear(data);
      }}
    >
      <h2 className="font-display text-2xl font-bold">Alta de cliente</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Código
          <input name="codigo" className={CAMPO} />
        </label>
        <label className="text-sm font-bold">
          Descuento %
          <input name="descuento" inputMode="numeric" placeholder="0" className={CAMPO} />
        </label>
        <label className="text-sm font-bold">
          Nombre *
          <input name="nombre" required className={CAMPO} />
        </label>
        <label className="text-sm font-bold">
          Apellido
          <input name="apellidos" className={CAMPO} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          Dirección
          <input name="direccion" className={CAMPO} />
        </label>
        <label className="text-sm font-bold">
          Teléfono *
          <input name="telefono" required inputMode="tel" className={CAMPO} />
        </label>
        <label className="text-sm font-bold">
          Cumpleaños
          <input name="cumpleanos" type="date" className={CAMPO} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          CUIT o DNI
          <input name="documento" className={CAMPO} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          Nota
          <textarea name="nota" rows={2} className={CAMPO} />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm font-black">
        <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
        Crear cuenta web
      </label>
      {web && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Mail *
            <input name="email" type="email" required className={CAMPO} />
          </label>
          <label className="text-sm font-bold">
            Contraseña *
            <input name="password" required className={CAMPO} />
          </label>
        </div>
      )}


      {aviso && <p className="mt-3 text-sm font-bold text-red-800">{aviso}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancelar} className={caja.boton}>
          Cancelar
        </button>
        <button type="submit" disabled={pending} className={caja.primario}>
          {pending ? "Guardando…" : "Aceptar"}
        </button>
      </div>
    </form>
  );
}
