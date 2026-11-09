# -*- coding: utf-8 -*-
"""Actualiza SOLO precio y costo desde el Excel TPV xlsx. No toca fotos, stock ni el resto."""
from __future__ import annotations

import json
import re
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
EXCEL = Path(r"C:\Users\leord\Downloads\ProductosTPV exel.xlsx")
OUT_JSON = ROOT / "data" / "productos.json"
REPORTE = ROOT / "data" / "reporte-actualizacion-tpv.json"
FOTOS = ROOT / "recursos" / "imagenes-productos"

SECTION_BLURB = {
    "BOLSAS": "Bolsas para delivery, mostrador y e-commerce. Consultanos medidas y cantidades.",
    "CAJAS MICRO": "Cajas microcorrugadas para hamburguesas, pizzas y delivery caliente.",
    "CAJAS Y ESTUCHES": "Cajas y estuches para regalos, desayunos y pastelería.",
    "COTILLON": "Cotillón, globos y detalles para fiestas. Stock para reponer al toque.",
    "DESCARTABLES": "Descartables de uso diario para gastronomía y comercio.",
    "EMBALAJE": "Cintas, film stretch y burbuja para armar y proteger envíos.",
    "EXPANDIDO": "Bandejas y obleas de expandido para carnicería y mostrador.",
    "HIGIENE": "Higiene y limpieza para el local: rollos, guantes y bolsas.",
    "LIBRERIA": "Librería y accesorios: cintas, moños, palitos y más.",
    "PERSONALIZADOS": "Bolsas personalizadas. Te asesoramos en medidas y cantidades.",
    "POTES": "Potes con tapa para salsas, postres y take away.",
    "REPOSTERIA": "Insumos y descartables de repostería para el obrador.",
    "ROLLOS": "Rollos de manteca, aluminio, sulfito y envasado.",
    "TERMICOS": "Vasos y marmitas térmicas para llevar caliente.",
    "VARIOS": "Bandejas y descartables varios para el día a día.",
}

SECTION_IMAGE = {
    "BOLSAS": "/recursos/imagenes-productos/bolsa-plastica.jpg",
    "CAJAS MICRO": "/recursos/imagenes-productos/caja-comida.jpg",
    "CAJAS Y ESTUCHES": "/recursos/imagenes-productos/caja-regalo.jpg",
    "COTILLON": "/recursos/imagenes-productos/cotillon.jpg",
    "DESCARTABLES": "/recursos/imagenes-productos/default.jpg",
    "EMBALAJE": "/recursos/imagenes-productos/cinta.jpg",
    "EXPANDIDO": "/recursos/imagenes-productos/bandeja-expandido.jpg",
    "HIGIENE": "/recursos/imagenes-productos/higiene.jpg",
    "LIBRERIA": "/recursos/imagenes-productos/libreria.jpg",
    "PERSONALIZADOS": "/recursos/imagenes-productos/bolsa-friselina.jpg",
    "POTES": "/recursos/imagenes-productos/pote.jpg",
    "REPOSTERIA": "/recursos/imagenes-productos/reposteria.jpg",
    "ROLLOS": "/recursos/imagenes-productos/rollos.jpg",
    "TERMICOS": "/recursos/imagenes-productos/vaso.jpg",
    "VARIOS": "/recursos/imagenes-productos/bandeja.jpg",
}


def entero(valor) -> int | None:
    if valor in (None, ""):
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    if n < 0:
        return None
    return int(round(n))


def codigo_norm(valor) -> str:
    if valor in (None, ""):
        return ""
    if isinstance(valor, float) and float(valor).is_integer():
        return str(int(valor))
    return re.sub(r"\s+", "", str(valor).strip())


def margen_de(costo, precio: int):
    if not isinstance(costo, (int, float)) or costo <= 0 or precio <= 0:
        return None
    return round((precio / costo - 1) * 100, 1)


def foto_auto(codigo: str) -> str | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        nombre = f"auto-{codigo}{ext}"
        if (FOTOS / nombre).exists():
            return f"/recursos/imagenes-productos/{nombre}"
    return None


def leer_excel(path: Path) -> list[dict]:
    wb = load_workbook(path, data_only=True, read_only=True)
    sh = wb[wb.sheetnames[0]]
    filas = []
    vistos: set[str] = set()
    for i, row in enumerate(sh.iter_rows(min_row=5, values_only=True), start=5):
        codigo = codigo_norm(row[0] if row else "")
        nombre = str(row[1] or "").strip() if row and len(row) > 1 else ""
        if not codigo or not nombre:
            continue
        if codigo in vistos:
            continue
        vistos.add(codigo)
        seccion = str(row[4] or "VARIOS").strip().upper() if len(row) > 4 else "VARIOS"
        filas.append(
            {
                "codigo": codigo,
                "nombre": nombre,
                "costo": entero(row[2] if len(row) > 2 else None),
                "precio": entero(row[3] if len(row) > 3 else None),
                "seccion": seccion or "VARIOS",
            }
        )
    wb.close()
    return filas


def aplicar(existentes: list[dict], filas: list[dict]):
    por_codigo: dict[str, list[dict]] = {}
    ids = {str(p.get("id") or "") for p in existentes}
    for p in existentes:
        por_codigo.setdefault(codigo_norm(p.get("codigo", "")), []).append(p)

    precios = 0
    costos = 0
    modificados = 0
    nuevos: list[dict] = []
    usados: set[str] = set()

    for fila in filas:
        candidatos = [
            p for p in por_codigo.get(fila["codigo"], []) if p.get("id") not in usados
        ]
        producto = candidatos[0] if candidatos else None
        if producto is None:
            pid = f"mp-{fila['codigo']}".lower()
            n = 2
            while pid in ids:
                pid = f"mp-{fila['codigo']}-{n}".lower()
                n += 1
            imagen = foto_auto(fila["codigo"]) or SECTION_IMAGE.get(
                fila["seccion"], "/recursos/imagenes-productos/default.jpg"
            )
            producto = {
                "id": pid,
                "codigo": fila["codigo"],
                "nombre": fila["nombre"],
                "seccion": fila["seccion"],
                "precio": fila["precio"] or 0,
                "imagen": imagen,
                "descripcion": SECTION_BLURB.get(
                    fila["seccion"],
                    "Consultá stock y precio por WhatsApp.",
                ),
            }
            if fila["costo"] is not None:
                producto["costo"] = fila["costo"]
            existentes.append(producto)
            ids.add(pid)
            por_codigo.setdefault(fila["codigo"], []).append(producto)
            nuevos.append(
                {"id": pid, "codigo": fila["codigo"], "nombre": fila["nombre"]}
            )
        else:
            cambio = False
            if fila["precio"] is not None and int(producto.get("precio") or 0) != fila["precio"]:
                producto["precio"] = fila["precio"]
                precios += 1
                cambio = True
            if fila["costo"] is not None and producto.get("costo") != fila["costo"]:
                producto["costo"] = fila["costo"]
                costos += 1
                cambio = True
            if cambio:
                modificados += 1

        usados.add(str(producto["id"]))
        margen = margen_de(producto.get("costo"), int(producto.get("precio") or 0))
        if margen is None:
            producto.pop("margen", None)
        else:
            producto["margen"] = margen

    return {
        "en_excel": len(filas),
        "catalogo_final": len(existentes),
        "productos_nuevos": len(nuevos),
        "productos_modificados": modificados,
        "precios_actualizados": precios,
        "costos_actualizados": costos,
        "sin_tocar": len(existentes) - len(usados) - len(nuevos),
        "altas": nuevos,
    }


def main() -> None:
    filas = leer_excel(EXCEL)
    existentes = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    reporte = aplicar(existentes, filas)
    OUT_JSON.write_text(
        json.dumps(existentes, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    REPORTE.write_text(
        json.dumps(reporte, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({k: v for k, v in reporte.items() if k != "altas"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
