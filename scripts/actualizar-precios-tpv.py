# -*- coding: utf-8 -*-
"""Actualiza precio, costo, stock y altas desde el Excel TPV, sin borrar fotos ni productos solo de la web."""
from __future__ import annotations

import json
import re
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[1]
EXCEL = Path(r"C:\Users\leord\Desktop\ProductosTPV 5-11.xls")
OUT_JSON = ROOT / "data" / "productos.json"
REPORTE = ROOT / "data" / "reporte-actualizacion-tpv.json"

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
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    return re.sub(r"\s+", "", str(valor).strip())


def nombre_norm(valor: str) -> str:
    return re.sub(r"\s+", " ", valor.strip().upper())


def margen_de(costo: int | None, precio: int) -> float | None:
    if costo is None or costo <= 0:
        return None
    return round((precio / costo - 1) * 100, 1)


def leer_excel(path: Path) -> list[dict]:
    wb = xlrd.open_workbook(str(path))
    sh = wb.sheet_by_index(0)
    filas = []
    for r in range(10, sh.nrows):
        nombre = str(sh.cell_value(r, 3)).strip()
        codigo = codigo_norm(sh.cell_value(r, 0))
        if not nombre or not codigo:
            continue
        if not re.search(r"\d", codigo) and sh.cell_value(r, 9) in (None, ""):
            continue
        seccion = str(sh.cell_value(r, 13)).strip().upper() or "VARIOS"
        barra = codigo_norm(sh.cell_value(r, 1))
        filas.append(
            {
                "codigo": codigo,
                "nombre": nombre,
                "seccion": seccion,
                "costo": entero(sh.cell_value(r, 8)),
                "precio": entero(sh.cell_value(r, 9)) or 0,
                "stock": entero(sh.cell_value(r, 11)),
                "stockMinimo": entero(sh.cell_value(r, 12)),
                "barra": barra,
            }
        )
    return filas


def aplicar(existentes: list[dict], filas: list[dict]):
    por_codigo: dict[str, list[dict]] = {}
    for p in existentes:
        por_codigo.setdefault(codigo_norm(p.get("codigo", "")), []).append(p)
    usados: set[str] = set()

    precios = 0
    costos = 0
    modificados = 0
    nuevos: list[dict] = []

    for fila in filas:
        candidatos = [
            p for p in por_codigo.get(fila["codigo"], []) if p.get("id") not in usados
        ]
        producto = candidatos[0] if candidatos else None
        if producto is None:
            pid = f"mp-{fila['codigo']}".lower()
            producto = {
                "id": pid,
                "codigo": fila["codigo"],
                "nombre": fila["nombre"],
                "seccion": fila["seccion"],
                "precio": fila["precio"],
                "imagen": SECTION_IMAGE.get(
                    fila["seccion"], "/recursos/imagenes-productos/default.jpg"
                ),
                "descripcion": SECTION_BLURB.get(
                    fila["seccion"],
                    "Consultá stock y precio por WhatsApp.",
                ),
            }
            existentes.append(producto)
            nuevos.append({"id": pid, "codigo": fila["codigo"], "nombre": fila["nombre"]})
        else:
            cambio = False
            if int(producto.get("precio") or 0) != fila["precio"]:
                producto["precio"] = fila["precio"]
                precios += 1
                cambio = True
            costo_antes = producto.get("costo")
            if fila["costo"] is None:
                if "costo" in producto:
                    del producto["costo"]
                    costos += 1
                    cambio = True
            elif costo_antes != fila["costo"]:
                producto["costo"] = fila["costo"]
                costos += 1
                cambio = True
            if str(producto.get("nombre") or "") != fila["nombre"]:
                producto["nombre"] = fila["nombre"]
                cambio = True
            if str(producto.get("seccion") or "") != fila["seccion"]:
                producto["seccion"] = fila["seccion"]
                cambio = True
            stock_antes = producto.get("stock")
            min_antes = producto.get("stockMinimo")
            if fila["stock"] is not None and stock_antes != fila["stock"]:
                cambio = True
            if fila["stockMinimo"] is not None and min_antes != fila["stockMinimo"]:
                cambio = True
            if cambio:
                modificados += 1

        usados.add(producto["id"])
        if fila["stock"] is not None:
            producto["stock"] = fila["stock"]
        if fila["stockMinimo"] is not None:
            producto["stockMinimo"] = fila["stockMinimo"]
        if fila["barra"]:
            producto["codigosBarra"] = [fila["barra"]]
        margen = margen_de(producto.get("costo"), int(producto.get("precio") or 0))
        if margen is None:
            producto.pop("margen", None)
        else:
            producto["margen"] = margen
        if producto.get("precioMayorista") is not None:
            producto["precioMayorista"] = round(producto["precioMayorista"])

    return {
        "en_excel": len(filas),
        "catalogo_final": len(existentes),
        "productos_nuevos": len(nuevos),
        "productos_modificados": modificados,
        "precios_actualizados": precios,
        "costos_actualizados": costos,
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
    print("altas", reporte["productos_nuevos"])


if __name__ == "__main__":
    main()
